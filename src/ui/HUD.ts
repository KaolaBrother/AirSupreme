import { GAME_CONSTANTS, GameConfig } from '@/config';
import {
  HUD_COLORS,
  detectHudLayoutDensity,
  injectHudTokens,
  type HudLayoutDensity,
} from '@/ui/theme/hudTokens';

type BigMessageVariant = 'announcement' | 'powerup';
type EventObjectiveTone = 'default' | 'complete';

type SettlementActions = {
  onRetry: () => void;
  onExitToMenu: () => void;
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

  private powerUpTimer: number = 0;
  private activePowerUpDuration: number = 0; // 道具持续时间
  private powerUpBigTimer: number = 0; // 大字提示显示计时器
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

  constructor() {
    injectHudTokens();
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
    this.applyBigMessageVariant(variant);
    this.setTextContent(this.powerUpBigIcon, icon);
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
    this.initialized = false;
  }
}
