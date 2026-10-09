import type { SpecialWeaponId } from '@/core/CombatContracts';
import { getCampaignChapter, getWeaponUnlockLevel } from '@/features/campaign/CampaignData';
import {
  UpgradeType,
  PlayerUpgrades,
  UPGRADE_CONFIGS,
  getWeaponIdForUpgrade,
} from '@/features/upgrade/UpgradeSystem';
import { getSpecialWeaponStats, type SpecialWeaponStats } from '@/features/weapons/WeaponTypes';
import { onLocaleChange, tr, type LocalizedText } from '@/i18n';
import { HUD_COLORS, injectHudTokens } from '@/ui/theme/hudTokens';

/** pause：对局中暂停升级（默认）；hangar：章节之间的机库整备 */
export type UpgradeMenuMode = 'pause' | 'hangar';

export interface UpgradeMenuShowOptions {
  mode?: UpgradeMenuMode;
  title?: string;
  subtitle?: string;
  /** 点击底部按钮时调用；缺省回退到构造参数 onResume。hangar 模式会先自行隐藏 */
  onContinue?: () => void;
}

interface UpgradeCardElements {
  card: HTMLDivElement;
  dots: HTMLDivElement[];
  tierLevel: HTMLSpanElement;
  tierCap: HTMLSpanElement;
  badge: HTMLSpanElement;
  currentValue: HTMLSpanElement;
  nextValue: HTMLSpanElement;
  gainValue: HTMLSpanElement;
  cost: HTMLDivElement;
  button: HTMLButtonElement;
}

interface UpgradeSection {
  title: LocalizedText;
  types: UpgradeType[];
}

interface WeaponMetric {
  label: LocalizedText;
  unit: string;
  value: (stats: SpecialWeaponStats) => number;
}

/** 锁定武器的解锁章节：未排进战役时显示“暂未解锁” */
const UNLOCK_LATER: LocalizedText = { en: 'a later chapter', zh: '暂未' };
const UNLOCKS_IN: LocalizedText = { en: 'Unlocks in {chapter}', zh: '{chapter}解锁' };
const MAXED: LocalizedText = { en: 'Maxed', zh: '已满级' };

/**
 * 升级菜单：对局中暂停升级（pause）与章节之间的机库整备（hangar）共用。
 * 每条升级线显示等级、本章上限（tier x/满级）、锁定的特殊武器及其解锁章节。
 * Military-aviation aesthetic with dark tones and sharp accents
 */
export class UpgradeMenu {
  private container: HTMLDivElement | null = null;
  private upgrades: PlayerUpgrades;
  private onUpgrade: (type: UpgradeType) => void;
  private onResume: () => void;
  private visible: boolean = false;
  private disposed: boolean = false;
  private mode: UpgradeMenuMode = 'pause';
  private continueOverride: (() => void) | null = null;
  private upgradeCards: Map<UpgradeType, UpgradeCardElements> = new Map();
  private pointsDisplay: HTMLDivElement | null = null;
  private footerPoints: HTMLSpanElement | null = null;
  private kickerDisplay: HTMLDivElement | null = null;
  private titleDisplay: HTMLDivElement | null = null;
  private subtitleDisplay: HTMLDivElement | null = null;
  private hintDisplay: HTMLDivElement | null = null;
  private resumeButton: HTMLButtonElement | null = null;
  /** 最近一次 show 的参数：语言切换后重建 DOM 时沿用 */
  private lastShowOptions: UpgradeMenuShowOptions = {};
  private readonly unsubscribeLocale: () => void;

  private static readonly PAUSE_TITLE = '⚙️ Upgrades';
  private static readonly HANGAR_TITLE: LocalizedText = { en: 'Refit & Rearm', zh: '机库整备' };

  /** 卡片短代号（航电风格，不用 emoji） */
  private static readonly UPGRADE_CODES: Record<UpgradeType, string> = {
    [UpgradeType.MAX_HEALTH]: 'HP',
    [UpgradeType.SPEED]: 'SPD',
    [UpgradeType.FIRE_RATE]: 'ROE',
    [UpgradeType.DAMAGE]: 'DMG',
    [UpgradeType.MISSILE_LOCK_RADIUS]: 'RAD',
    [UpgradeType.MISSILE_RELOAD_TIME]: 'RLD',
    [UpgradeType.MISSILE_LOCK_TIME]: 'LCK',
    [UpgradeType.ARMOR]: 'ARM',
    [UpgradeType.FLARES]: 'FLR',
    [UpgradeType.WEAPON_ROCKETS]: 'RKT',
    [UpgradeType.WEAPON_LASER]: 'LSR',
    [UpgradeType.WEAPON_SWARM]: 'SWM',
    [UpgradeType.WEAPON_RAILGUN]: 'RLG',
    [UpgradeType.WEAPON_EMP]: 'EMP',
  };

  private static readonly SECTIONS: ReadonlyArray<UpgradeSection> = [
    {
      title: { en: 'AIRFRAME', zh: '机体' },
      types: [UpgradeType.MAX_HEALTH, UpgradeType.SPEED, UpgradeType.FIRE_RATE, UpgradeType.DAMAGE],
    },
    {
      title: { en: 'MISSILES', zh: '导弹' },
      types: [
        UpgradeType.MISSILE_LOCK_RADIUS,
        UpgradeType.MISSILE_RELOAD_TIME,
        UpgradeType.MISSILE_LOCK_TIME,
      ],
    },
    { title: { en: 'DEFENSE', zh: '防护' }, types: [UpgradeType.ARMOR, UpgradeType.FLARES] },
    {
      title: { en: 'SPECIAL WEAPONS', zh: '特殊武器' },
      types: [
        UpgradeType.WEAPON_ROCKETS,
        UpgradeType.WEAPON_LASER,
        UpgradeType.WEAPON_SWARM,
        UpgradeType.WEAPON_RAILGUN,
        UpgradeType.WEAPON_EMP,
      ],
    },
  ];

  private static readonly DISPLAY_ORDER: UpgradeType[] = UpgradeMenu.SECTIONS.flatMap(
    (section) => section.types
  );

  /** 特殊武器卡片的代表数值（来自 getSpecialWeaponStats 的 0..5 级曲线） */
  private static readonly WEAPON_METRICS: Record<SpecialWeaponId, WeaponMetric> = {
    rockets: {
      label: { en: 'Salvo dmg', zh: '齐射伤害' },
      unit: '',
      value: (s) => s.projectileCount * s.damage,
    },
    laser: { label: { en: 'DPS', zh: '每秒伤害' }, unit: '', value: (s) => s.damage },
    swarm: {
      label: { en: 'Salvo dmg', zh: '齐射伤害' },
      unit: '',
      value: (s) => s.projectileCount * s.damage,
    },
    railgun: { label: { en: 'Full charge', zh: '满蓄伤害' }, unit: '', value: (s) => s.damage },
    emp: { label: { en: 'Stun time', zh: '瘫痪时长' }, unit: 's', value: (s) => s.stunSeconds },
  };

  constructor(
    upgrades: PlayerUpgrades,
    onUpgrade: (type: UpgradeType) => void,
    onResume: () => void
  ) {
    injectHudTokens();
    this.upgrades = upgrades;
    this.onUpgrade = onUpgrade;
    this.onResume = onResume;
    this.unsubscribeLocale = onLocaleChange(() => this.handleLocaleChange());
  }

  /**
   * 语言切换：卡片里的静态文字（分区、数值标签、升级名称与说明）都在创建 DOM 时写入，
   * 因此直接丢弃旧 DOM；正在显示时按原参数立即重建，否则等下次 show 再按新语言创建。
   */
  private handleLocaleChange(): void {
    if (this.disposed || !this.container) {
      return;
    }
    const wasVisible = this.visible;
    this.releaseDom();
    if (wasVisible) {
      this.show(this.lastShowOptions);
    }
  }

  private releaseDom(): void {
    this.container?.remove();
    this.container = null;
    this.upgradeCards.clear();
    this.pointsDisplay = null;
    this.footerPoints = null;
    this.kickerDisplay = null;
    this.titleDisplay = null;
    this.subtitleDisplay = null;
    this.hintDisplay = null;
    this.resumeButton = null;
  }

  /**
   * 显示菜单。无参数时保持原有的暂停升级行为（标题、返回战斗按钮 → onResume）；
   * mode 'hangar' 为章节之间的机库整备：默认标题“机库整备”、副标题为即将进入的章节，
   * 底部按钮“出击”先隐藏菜单再调用 onContinue（缺省 onResume）。
   */
  public show(options?: UpgradeMenuShowOptions): void {
    if (this.disposed) {
      return;
    }
    if (!this.container) {
      this.container = this.createContainer();
      document.body.appendChild(this.container);
    }
    this.lastShowOptions = options ?? {};
    this.applyMode(this.lastShowOptions);
    this.updateDisplay();
    this.container.style.display = 'flex';
    this.visible = true;
  }

  public hide(): void {
    if (this.disposed) {
      return;
    }
    if (this.container) {
      this.container.style.display = 'none';
    }
    this.visible = false;
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public getMode(): UpgradeMenuMode {
    return this.mode;
  }

  public updateDisplay(): void {
    if (this.disposed || !this.container) return;

    const points = this.upgrades.getAvailablePoints();
    if (this.pointsDisplay) {
      this.pointsDisplay.textContent = this.formatPointsHeadline(points);
      this.pointsDisplay.classList.toggle('has-points', points > 0);
    }
    if (this.footerPoints) {
      this.footerPoints.textContent = tr(
        { en: '⭐ Points available: {points}', zh: '⭐ {points} 点可用' },
        { points }
      );
    }

    UpgradeMenu.DISPLAY_ORDER.forEach((type) => {
      this.updateUpgradeCard(type);
    });
  }

  private applyMode(options: UpgradeMenuShowOptions): void {
    const hangar = options.mode === 'hangar';
    this.mode = hangar ? 'hangar' : 'pause';
    this.continueOverride = options.onContinue ?? null;

    const subtitle = options.subtitle ?? (hangar ? this.getDefaultHangarSubtitle() : '');
    if (this.titleDisplay) {
      this.titleDisplay.textContent =
        options.title ?? (hangar ? tr(UpgradeMenu.HANGAR_TITLE) : UpgradeMenu.PAUSE_TITLE);
    }
    if (this.subtitleDisplay) {
      this.subtitleDisplay.textContent = subtitle;
      this.subtitleDisplay.style.display = subtitle ? '' : 'none';
    }
    if (this.kickerDisplay) {
      this.kickerDisplay.style.display = hangar ? '' : 'none';
    }
    if (this.hintDisplay) {
      this.hintDisplay.style.display = hangar ? '' : 'none';
    }
    if (this.resumeButton) {
      this.resumeButton.textContent = hangar
        ? tr({ en: 'Launch', zh: '出击' })
        : tr({ en: '▶ Back to battle', zh: '▶ 返回战斗' });
      this.resumeButton.classList.toggle('hangar', hangar);
    }
    this.container?.classList.toggle('mode-hangar', hangar);
  }

  private getDefaultHangarSubtitle(): string {
    const chapter = getCampaignChapter(this.upgrades.getCampaignLevel());
    return tr(
      { en: 'Next: {chapter} · {title}', zh: '下一站：{chapter} · {title}' },
      { chapter: chapter.chapterLabel, title: chapter.title }
    );
  }

  private formatPointsHeadline(points: number): string {
    return tr({ en: '⭐ Upgrade points: {points}', zh: '⭐ 可用升级点: {points}' }, { points });
  }

  private handleContinue(): void {
    const callback = this.continueOverride ?? this.onResume;
    if (this.mode === 'hangar') {
      this.hide();
    }
    callback();
  }

  private createContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'upgrade-menu';

    const style = document.createElement('style');
    style.textContent = `
      #upgrade-menu {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(8, 14, 24, 0.92);
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0 20px;
        z-index: 999;
        font-family: var(--hud-font, 'Arial', sans-serif);
        color: var(--hud-text, ${HUD_COLORS.text});
        box-sizing: border-box;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }

      #upgrade-menu.mode-hangar {
        background: radial-gradient(ellipse at top, rgba(20, 38, 58, 0.98), rgba(6, 10, 18, 0.99) 70%);
      }

      #upgrade-menu::-webkit-scrollbar {
        width: 6px;
      }

      #upgrade-menu::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
      }

      #upgrade-menu::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 3px;
      }

      #upgrade-menu::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.5);
      }

      .upgrade-header {
        text-align: center;
        padding: 20px 0 6px;
        margin-bottom: 10px;
        flex-shrink: 0;
      }

      .upgrade-kicker {
        font-family: var(--hud-mono, 'Consolas', monospace);
        font-size: 12px;
        letter-spacing: 0.32em;
        color: var(--hud-sys, ${HUD_COLORS.sys});
        margin-bottom: 6px;
      }

      .upgrade-title {
        font-size: 36px;
        font-weight: 700;
        letter-spacing: 4px;
        text-transform: uppercase;
        background: linear-gradient(135deg, #00ff88, #00ccff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin-bottom: 8px;
      }

      .upgrade-subtitle {
        font-size: 16px;
        letter-spacing: 0.08em;
        color: var(--hud-muted, ${HUD_COLORS.muted});
        margin-bottom: 10px;
      }

      .upgrade-points {
        font-size: 22px;
        font-weight: 600;
        color: #ffd700;
        text-shadow: 0 0 8px rgba(255, 215, 0, 0.35);
      }

      .upgrade-points.has-points {
        animation: upgrade-points-pulse 2s ease-in-out infinite;
      }

      .upgrade-hint {
        margin-top: 6px;
        font-size: 13px;
        color: var(--hud-muted, ${HUD_COLORS.muted});
      }

      @keyframes upgrade-points-pulse {
        0%, 100% {
          text-shadow: 0 0 8px rgba(255, 215, 0, 0.35);
          transform: scale(1);
        }
        50% {
          text-shadow: 0 0 14px rgba(255, 215, 0, 0.65);
          transform: scale(1.02);
        }
      }

      .upgrade-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 14px 16px;
        max-width: 760px;
        width: 100%;
        margin-bottom: 16px;
      }

      @media (min-width: 1100px) {
        .upgrade-grid {
          grid-template-columns: repeat(3, 1fr);
          max-width: 1120px;
        }
      }

      @media (max-width: 600px) {
        .upgrade-grid {
          grid-template-columns: 1fr;
          max-width: 460px;
        }

        .upgrade-title {
          font-size: 28px;
          letter-spacing: 2px;
        }

        .upgrade-points {
          font-size: 18px;
        }
      }

      .upgrade-section-title {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 6px;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.3em;
        color: var(--hud-sys, ${HUD_COLORS.sys});
      }

      .upgrade-section-title::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--hud-edge, ${HUD_COLORS.edge});
      }

      .upgrade-card {
        background: linear-gradient(145deg, rgba(30, 40, 55, 0.9), rgba(20, 25, 35, 0.95));
        border: 2px solid rgba(100, 120, 140, 0.3);
        border-radius: 12px;
        padding: 12px 14px;
        transition: all 0.25s ease;
        position: relative;
        overflow: hidden;
      }

      .upgrade-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, transparent, rgba(100, 120, 140, 0.5), transparent);
      }

      .upgrade-card.upgradeable {
        border-color: #00ff88;
        box-shadow: 0 0 16px rgba(0, 255, 136, 0.15), inset 0 0 24px rgba(0, 255, 136, 0.05);
      }

      .upgrade-card.upgradeable::before {
        background: linear-gradient(90deg, transparent, #00ff88, transparent);
      }

      .upgrade-card.maxed {
        border-color: #ffd700;
        opacity: 0.86;
      }

      .upgrade-card.maxed::before {
        background: linear-gradient(90deg, transparent, #ffd700, transparent);
      }

      .upgrade-card.capped {
        border-color: rgba(143, 228, 255, 0.4);
        border-style: dashed;
      }

      .upgrade-card.weapon-locked {
        opacity: 0.58;
        filter: grayscale(0.5);
      }

      .card-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }

      .card-icon {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.08em;
        font-family: var(--hud-mono, 'Consolas', monospace);
        color: var(--hud-sys, ${HUD_COLORS.sys});
        min-width: 2.4em;
      }

      .card-name {
        font-size: 16px;
        font-weight: 600;
        letter-spacing: 0.08em;
        color: var(--hud-text, ${HUD_COLORS.text});
        flex: 1;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .card-badge {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.1em;
        padding: 2px 6px;
        border-radius: 4px;
        color: #1a1a2e;
        background: var(--hud-ally, ${HUD_COLORS.ally});
      }

      .level-dots {
        display: flex;
        gap: 5px;
        flex-shrink: 0;
      }

      .level-dots.dense {
        gap: 3px;
      }

      .level-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: rgba(100, 120, 140, 0.3);
        border: 1px solid rgba(100, 120, 140, 0.5);
        box-sizing: border-box;
        transition: all 0.25s ease;
      }

      .level-dots.dense .level-dot {
        width: 8px;
        height: 8px;
      }

      .level-dot.filled {
        background: linear-gradient(135deg, #00ff88, #00ccff);
        border-color: #00ff88;
        box-shadow: 0 0 6px rgba(0, 255, 136, 0.5);
      }

      .level-dot.over-cap {
        background: transparent;
        border: 1px dashed rgba(143, 228, 255, 0.3);
      }

      .card-desc {
        font-size: 13px;
        color: #9db0c2;
        margin-bottom: 8px;
        min-height: 18px;
      }

      .card-tier {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
        font-size: 12px;
        margin-bottom: 8px;
        padding: 4px 8px;
        border-radius: 6px;
        background: rgba(143, 228, 255, 0.06);
      }

      .tier-level {
        font-family: var(--hud-mono, 'Consolas', monospace);
        font-weight: 700;
        color: var(--hud-sys, ${HUD_COLORS.sys});
        white-space: nowrap;
      }

      .tier-cap {
        color: var(--hud-muted, ${HUD_COLORS.muted});
        text-align: right;
      }

      .upgrade-card.capped .tier-cap,
      .upgrade-card.weapon-locked .tier-cap {
        color: var(--hud-ally, ${HUD_COLORS.ally});
      }

      .card-stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
        gap: 6px 10px;
        margin-bottom: 10px;
        padding: 0 2px;
      }

      @media (max-width: 360px) {
        .card-stats {
          grid-template-columns: 1fr 1fr;
        }
      }

      .stat-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .stat-label {
        font-size: 11px;
        color: #88a0b4;
      }

      .stat-value {
        font-size: 14px;
        font-weight: 600;
      }

      .stat-value.current {
        color: #00ccff;
      }

      .stat-value.next {
        color: #9dffc8;
      }

      .stat-value.gain {
        color: #ffd166;
      }

      .upgrade-cost {
        font-size: 13px;
        color: #ffd700;
        text-align: right;
        align-self: end;
      }

      .card-action {
        display: flex;
        justify-content: center;
      }

      .upgrade-btn {
        width: 100%;
        padding: 10px 14px;
        font-size: 14px;
        font-weight: 600;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        letter-spacing: 0.5px;
      }

      .upgrade-btn.available {
        background: linear-gradient(135deg, #0088ff, #00ccff);
        color: white;
        box-shadow: 0 4px 12px rgba(0, 136, 255, 0.4);
      }

      .upgrade-btn.available:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(0, 136, 255, 0.55);
      }

      .upgrade-btn.available:active {
        transform: translateY(0);
      }

      .upgrade-btn.locked {
        background: rgba(60, 70, 80, 0.6);
        color: #7f8f9f;
        cursor: not-allowed;
      }

      .upgrade-btn.maxed {
        background: linear-gradient(135deg, #ffd700, #ffaa00);
        color: #1a1a2e;
        cursor: default;
      }

      .resume-container {
        position: sticky;
        bottom: 0;
        z-index: 2;
        align-self: stretch;
        display: flex;
        justify-content: center;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px 22px;
        margin: auto -20px 0;
        padding: 18px 20px 18px;
        flex-shrink: 0;
        background: linear-gradient(rgba(8, 14, 24, 0), rgba(8, 14, 24, 0.95) 35%);
      }

      .footer-points {
        font-size: 15px;
        font-weight: 600;
        color: #ffd700;
        white-space: nowrap;
      }

      .resume-btn {
        padding: 14px 36px;
        font-size: 16px;
        font-weight: 700;
        border: 1px solid var(--hud-edge, ${HUD_COLORS.edge});
        border-radius: var(--hud-radius, 12px);
        background: var(--hud-glass, ${HUD_COLORS.glass});
        color: var(--hud-text, ${HUD_COLORS.text});
        cursor: pointer;
        transition: border-color 0.2s, box-shadow 0.2s;
        letter-spacing: 1px;
        box-shadow: var(--hud-shadow, ${HUD_COLORS.shadow});
      }

      .resume-btn:hover {
        border-color: var(--hud-sys, ${HUD_COLORS.sys});
        box-shadow: 0 0 16px rgba(143, 228, 255, 0.28);
      }

      .resume-btn:active {
        box-shadow: inset 0 3px 10px rgba(0, 0, 0, 0.45);
      }

      .resume-btn.hangar {
        min-width: 220px;
        letter-spacing: 0.4em;
        border-color: var(--hud-sys, ${HUD_COLORS.sys});
        box-shadow: 0 0 18px rgba(143, 228, 255, 0.25), var(--hud-shadow, ${HUD_COLORS.shadow});
      }

      .resume-btn.hangar::after {
        content: ' ▶';
        letter-spacing: 0;
      }

      @media (max-width: 600px) {
        .upgrade-card {
          padding: 12px;
        }

        .card-name {
          font-size: 15px;
        }

        .card-desc {
          font-size: 12px;
          min-height: 16px;
        }

        .upgrade-btn {
          padding: 12px 10px;
          font-size: 14px;
        }
      }
    `;

    container.appendChild(style);

    const header = document.createElement('div');
    header.className = 'upgrade-header';

    this.kickerDisplay = document.createElement('div');
    this.kickerDisplay.className = 'upgrade-kicker';
    this.kickerDisplay.textContent = tr({ en: 'HANGAR · PRE-FLIGHT', zh: 'HANGAR · 出击准备' });
    this.kickerDisplay.style.display = 'none';

    this.titleDisplay = document.createElement('div');
    this.titleDisplay.className = 'upgrade-title';
    this.titleDisplay.textContent = UpgradeMenu.PAUSE_TITLE;

    this.subtitleDisplay = document.createElement('div');
    this.subtitleDisplay.className = 'upgrade-subtitle';
    this.subtitleDisplay.style.display = 'none';

    this.pointsDisplay = document.createElement('div');
    this.pointsDisplay.className = 'upgrade-points';
    this.pointsDisplay.textContent = this.formatPointsHeadline(this.upgrades.getAvailablePoints());

    this.hintDisplay = document.createElement('div');
    this.hintDisplay.className = 'upgrade-hint';
    this.hintDisplay.textContent = tr({
      en: 'Upgrade caps rise as the campaign advances. Unspent points carry over.',
      zh: '强化上限随章节推进逐步开放，未用完的升级点会保留',
    });
    this.hintDisplay.style.display = 'none';

    header.appendChild(this.kickerDisplay);
    header.appendChild(this.titleDisplay);
    header.appendChild(this.subtitleDisplay);
    header.appendChild(this.pointsDisplay);
    header.appendChild(this.hintDisplay);
    container.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'upgrade-grid';

    UpgradeMenu.SECTIONS.forEach((section) => {
      const sectionTitle = document.createElement('div');
      sectionTitle.className = 'upgrade-section-title';
      sectionTitle.textContent = tr(section.title);
      grid.appendChild(sectionTitle);

      section.types.forEach((type) => {
        const card = this.createUpgradeCard(type);
        this.upgradeCards.set(type, card);
        grid.appendChild(card.card);
      });
    });

    container.appendChild(grid);

    const resumeContainer = document.createElement('div');
    resumeContainer.className = 'resume-container';

    // 卡片较多时页头会滚出视野，底栏常驻显示剩余升级点
    this.footerPoints = document.createElement('span');
    this.footerPoints.className = 'footer-points';
    resumeContainer.appendChild(this.footerPoints);

    const resumeBtn = document.createElement('button');
    resumeBtn.className = 'resume-btn';
    resumeBtn.textContent = tr({ en: '▶ Back to battle', zh: '▶ 返回战斗' });
    resumeBtn.onclick = () => this.handleContinue();
    this.resumeButton = resumeBtn;

    resumeContainer.appendChild(resumeBtn);
    container.appendChild(resumeContainer);

    return container;
  }

  private createUpgradeCard(type: UpgradeType): UpgradeCardElements {
    const card = document.createElement('div');
    card.className = 'upgrade-card';
    card.id = `upgrade-card-${type}`;
    card.dataset.category = UPGRADE_CONFIGS[type].category;

    const config = UPGRADE_CONFIGS[type];
    const level = this.upgrades.getLevel(type);
    const weaponId = getWeaponIdForUpgrade(type);

    const header = document.createElement('div');
    header.className = 'card-header';

    const icon = document.createElement('span');
    icon.className = 'card-icon';
    icon.textContent = UpgradeMenu.UPGRADE_CODES[type];

    const name = document.createElement('span');
    name.className = 'card-name';
    name.textContent = config.name;

    const badge = document.createElement('span');
    badge.className = 'card-badge';
    badge.textContent = tr({ en: 'NEW', zh: '新解锁' });
    badge.style.display = 'none';

    const dotsContainer = document.createElement('div');
    dotsContainer.className = config.maxLevel > 5 ? 'level-dots dense' : 'level-dots';
    const dots: HTMLDivElement[] = [];
    for (let i = 0; i < config.maxLevel; i++) {
      const dot = document.createElement('div');
      dot.className = 'level-dot';
      if (i < level) {
        dot.classList.add('filled');
      }
      dots.push(dot);
      dotsContainer.appendChild(dot);
    }

    header.appendChild(icon);
    header.appendChild(name);
    header.appendChild(badge);
    header.appendChild(dotsContainer);

    const description = document.createElement('div');
    description.className = 'card-desc';
    description.textContent = config.description;

    const tier = document.createElement('div');
    tier.className = 'card-tier';
    const tierLevel = document.createElement('span');
    tierLevel.className = 'tier-level';
    const tierCap = document.createElement('span');
    tierCap.className = 'tier-cap';
    tier.appendChild(tierLevel);
    tier.appendChild(tierCap);

    const stats = document.createElement('div');
    stats.className = 'card-stats';

    const metric = weaponId ? UpgradeMenu.WEAPON_METRICS[weaponId] : null;
    const currentStat = this.createStatItem(
      tr(metric ? metric.label : { en: 'Current', zh: '当前' }),
      'current'
    );
    const nextStat = this.createStatItem(tr({ en: 'Next', zh: '下一级' }), 'next');
    const gainStat = this.createStatItem(
      metric ? tr({ en: 'Gain', zh: '本级提升' }) : tr({ en: 'Per level', zh: '每级收益' }),
      'gain'
    );

    const costDisplay = document.createElement('div');
    costDisplay.className = 'upgrade-cost';
    costDisplay.id = `cost-${type}`;

    stats.appendChild(currentStat.container);
    stats.appendChild(nextStat.container);
    stats.appendChild(gainStat.container);
    stats.appendChild(costDisplay);

    const action = document.createElement('div');
    action.className = 'card-action';

    const btn = document.createElement('button');
    btn.className = 'upgrade-btn';
    btn.id = `btn-${type}`;
    action.appendChild(btn);

    card.appendChild(header);
    card.appendChild(description);
    card.appendChild(tier);
    card.appendChild(stats);
    card.appendChild(action);

    return {
      card,
      dots,
      tierLevel,
      tierCap,
      badge,
      currentValue: currentStat.value,
      nextValue: nextStat.value,
      gainValue: gainStat.value,
      cost: costDisplay,
      button: btn,
    };
  }

  private createStatItem(
    label: string,
    valueClass: 'current' | 'next' | 'gain'
  ): { container: HTMLDivElement; value: HTMLSpanElement } {
    const container = document.createElement('div');
    container.className = 'stat-item';

    const labelEl = document.createElement('span');
    labelEl.className = 'stat-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = `stat-value ${valueClass}`;

    container.appendChild(labelEl);
    container.appendChild(valueEl);

    return { container, value: valueEl };
  }

  private updateUpgradeCard(type: UpgradeType): void {
    const elements = this.upgradeCards.get(type);
    if (!elements) return;

    const config = UPGRADE_CONFIGS[type];
    const level = this.upgrades.getLevel(type);
    const cap = this.upgrades.getCap(type);
    const isLocked = this.upgrades.isLocked(type);
    const canUpgrade = this.upgrades.canUpgrade(type);
    const isMaxed = level >= config.maxLevel;
    const isCapped = !isMaxed && !isLocked && level >= cap;
    const weaponId = getWeaponIdForUpgrade(type);
    const unlockLevel = weaponId ? getWeaponUnlockLevel(weaponId) : null;
    const unlockLabel =
      unlockLevel === null ? tr(UNLOCK_LATER) : getCampaignChapter(unlockLevel).chapterLabel;
    const unlockText = tr(UNLOCKS_IN, { chapter: unlockLabel });
    const nextRaiseLevel = this.upgrades.getNextCapRaiseLevel(type);

    elements.card.classList.remove('upgradeable', 'maxed', 'capped', 'weapon-locked');
    if (isMaxed) {
      elements.card.classList.add('maxed');
    } else if (isLocked) {
      elements.card.classList.add('weapon-locked');
    } else if (canUpgrade) {
      elements.card.classList.add('upgradeable');
    } else if (isCapped) {
      elements.card.classList.add('capped');
    }

    const isFresh =
      !isLocked && unlockLevel !== null && unlockLevel === this.upgrades.getCampaignLevel();
    elements.badge.style.display = isFresh ? '' : 'none';

    const openTiers = isLocked ? 0 : cap;
    elements.dots.forEach((dot, i) => {
      dot.classList.toggle('filled', i < level);
      dot.classList.toggle('over-cap', i >= level && i >= openTiers);
    });

    elements.tierLevel.textContent = `Lv ${level}/${config.maxLevel}`;
    if (isLocked) {
      elements.tierCap.textContent = unlockText;
    } else if (isMaxed) {
      elements.tierCap.textContent = tr(MAXED);
    } else {
      const raise =
        nextRaiseLevel === null
          ? ''
          : tr(
              { en: ' · rises in Level {level}', zh: ' · 第{level}关提升' },
              {
                level: nextRaiseLevel,
              }
            );
      elements.tierCap.textContent =
        tr(
          { en: 'Chapter cap {cap}/{max}', zh: '本章上限 {cap}/{max}' },
          { cap, max: config.maxLevel }
        ) + raise;
    }

    this.updateCardValues(type, elements, level, isMaxed);

    if (!isMaxed) {
      const cost = this.upgrades.getUpgradeCost(type);
      elements.cost.textContent = tr({ en: 'Cost: ⭐{cost}', zh: '花费: ⭐{cost}' }, { cost });
    } else {
      elements.cost.textContent = tr(MAXED);
    }

    elements.button.classList.remove('available', 'locked', 'maxed');
    elements.button.onclick = null;

    if (isMaxed) {
      elements.button.classList.add('maxed');
      elements.button.textContent = `✓ ${tr(MAXED)}`;
      return;
    }

    if (canUpgrade) {
      elements.button.classList.add('available');
      const cost = this.upgrades.getUpgradeCost(type);
      elements.button.textContent = this.getUpgradeButtonLabel(cost);
      elements.button.onclick = () => {
        this.onUpgrade(type);
        this.updateDisplay();
      };
      return;
    }

    elements.button.classList.add('locked');
    if (isLocked) {
      elements.button.textContent = unlockText;
    } else if (isCapped) {
      elements.button.textContent =
        nextRaiseLevel === null
          ? tr({ en: 'Chapter cap reached', zh: '已达本章上限' })
          : tr(
              { en: 'Cap reached · opens in Level {level}', zh: '已达本章上限 · 第{level}关开放' },
              { level: nextRaiseLevel }
            );
    } else {
      elements.button.textContent = tr(
        { en: 'Not enough points ({cost} needed)', zh: '升级点不足 ({cost}点)' },
        { cost: this.upgrades.getUpgradeCost(type) }
      );
    }
  }

  /** 当前 / 下一级 / 收益：普通升级线取线性数值，特殊武器取代表性能数值 */
  private updateCardValues(
    type: UpgradeType,
    elements: UpgradeCardElements,
    level: number,
    isMaxed: boolean
  ): void {
    const config = UPGRADE_CONFIGS[type];
    const weaponId = getWeaponIdForUpgrade(type);

    if (weaponId) {
      const metric = UpgradeMenu.WEAPON_METRICS[weaponId];
      const current = metric.value(getSpecialWeaponStats(weaponId, level));
      const next = metric.value(getSpecialWeaponStats(weaponId, level + 1));
      elements.currentValue.textContent = this.formatValue(current, metric.unit);
      elements.nextValue.textContent = isMaxed ? 'MAX' : this.formatValue(next, metric.unit);
      elements.gainValue.textContent = this.formatDelta(next - current, metric.unit, isMaxed);
      return;
    }

    const currentValue = this.upgrades.getValue(type);
    const nextValue = isMaxed ? currentValue : currentValue + config.valuePerLevel;

    elements.currentValue.textContent = this.formatValue(currentValue, config.unit);
    elements.nextValue.textContent = isMaxed ? 'MAX' : this.formatValue(nextValue, config.unit);
    elements.gainValue.textContent = this.formatDelta(config.valuePerLevel, config.unit, isMaxed);
  }

  private getUpgradeButtonLabel(cost: number): string {
    const isMobile = window.innerWidth <= 600;
    return isMobile
      ? tr({ en: 'Upgrade (⭐{cost})', zh: '升级 ({cost}点)' }, { cost })
      : tr({ en: 'Upgrade now (⭐{cost})', zh: '立即升级 ({cost} 点)' }, { cost });
  }

  private formatValue(value: number, unit: string): string {
    const rounded = Math.round(value * 100) / 100;
    return unit ? `${rounded}${unit}` : `${rounded}`;
  }

  private formatDelta(delta: number, unit: string, isMaxed: boolean): string {
    if (isMaxed) {
      return 'MAX';
    }

    const absValue = Math.abs(Math.round(delta * 100) / 100);
    const sign = delta >= 0 ? '+' : '-';
    return unit ? `${sign}${absValue}${unit}` : `${sign}${absValue}`;
  }

  public dispose(): void {
    this.disposed = true;
    this.visible = false;
    this.unsubscribeLocale();
    this.releaseDom();
    this.continueOverride = null;
  }
}
