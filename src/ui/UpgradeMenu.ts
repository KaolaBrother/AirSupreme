import { UpgradeType, PlayerUpgrades, UPGRADE_CONFIGS } from '@/features/upgrade/UpgradeSystem';

interface UpgradeCardElements {
  card: HTMLDivElement;
  currentValue: HTMLSpanElement;
  nextValue: HTMLSpanElement;
  gainValue: HTMLSpanElement;
  cost: HTMLDivElement;
  button: HTMLButtonElement;
}

/**
 * 升级菜单 - 显示在暂停菜单中
 * Military-aviation aesthetic with dark tones and sharp accents
 */
export class UpgradeMenu {
  private container: HTMLDivElement | null = null;
  private upgrades: PlayerUpgrades;
  private onUpgrade: (type: UpgradeType) => void;
  private onResume: () => void;
  private visible: boolean = false;
  private disposed: boolean = false;
  private upgradeCards: Map<UpgradeType, UpgradeCardElements> = new Map();
  private pointsDisplay: HTMLDivElement | null = null;

  private static readonly UPGRADE_INFO: Record<UpgradeType, { icon: string; label: string }> = {
    [UpgradeType.MAX_HEALTH]: { icon: '❤️', label: 'HP' },
    [UpgradeType.SPEED]: { icon: '⚡', label: 'Speed' },
    [UpgradeType.FIRE_RATE]: { icon: '🔫', label: 'Fire Rate' },
    [UpgradeType.DAMAGE]: { icon: '💥', label: 'Damage' },
    [UpgradeType.MISSILE_LOCK_RADIUS]: { icon: '📡', label: 'Lock Radius' },
    [UpgradeType.MISSILE_RELOAD_TIME]: { icon: '🚀', label: 'Missile Reload' },
    [UpgradeType.MISSILE_LOCK_TIME]: { icon: '🎯', label: 'Missile Lock' },
  };

  private static readonly DISPLAY_ORDER: UpgradeType[] = [
    UpgradeType.MAX_HEALTH,
    UpgradeType.SPEED,
    UpgradeType.FIRE_RATE,
    UpgradeType.DAMAGE,
    UpgradeType.MISSILE_LOCK_RADIUS,
    UpgradeType.MISSILE_RELOAD_TIME,
    UpgradeType.MISSILE_LOCK_TIME,
  ];

  constructor(
    upgrades: PlayerUpgrades,
    onUpgrade: (type: UpgradeType) => void,
    onResume: () => void
  ) {
    this.upgrades = upgrades;
    this.onUpgrade = onUpgrade;
    this.onResume = onResume;
  }

  public show(): void {
    if (this.disposed) {
      return;
    }
    if (!this.container) {
      this.container = this.createContainer();
      document.body.appendChild(this.container);
    }
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

  public updateDisplay(): void {
    if (this.disposed || !this.container) return;

    const points = this.upgrades.getAvailablePoints();
    if (this.pointsDisplay) {
      this.pointsDisplay.textContent = `⭐ 可用升级点: ${points}`;
      this.pointsDisplay.classList.toggle('has-points', points > 0);
    }

    UpgradeMenu.DISPLAY_ORDER.forEach((type) => {
      this.updateUpgradeCard(type);
    });
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
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20px;
        z-index: 999;
        font-family: 'Segoe UI', 'Arial', sans-serif;
        color: white;
        box-sizing: border-box;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
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
        margin-bottom: 24px;
        flex-shrink: 0;
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
        margin-bottom: 12px;
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
        gap: 16px;
        max-width: 760px;
        width: 100%;
        margin-bottom: 24px;
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

      .upgrade-card {
        background: linear-gradient(145deg, rgba(30, 40, 55, 0.9), rgba(20, 25, 35, 0.95));
        border: 2px solid rgba(100, 120, 140, 0.3);
        border-radius: 12px;
        padding: 14px;
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

      .card-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }

      .card-icon {
        font-size: 24px;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
      }

      .card-name {
        font-size: 16px;
        font-weight: 600;
        color: #e0e8f0;
        flex: 1;
      }

      .level-dots {
        display: flex;
        gap: 5px;
      }

      .level-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: rgba(100, 120, 140, 0.3);
        border: 1px solid rgba(100, 120, 140, 0.5);
        transition: all 0.25s ease;
      }

      .level-dot.filled {
        background: linear-gradient(135deg, #00ff88, #00ccff);
        border-color: #00ff88;
        box-shadow: 0 0 6px rgba(0, 255, 136, 0.5);
      }

      .card-desc {
        font-size: 13px;
        color: #9db0c2;
        margin-bottom: 10px;
        min-height: 20px;
      }

      .card-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px 10px;
        margin-bottom: 12px;
        padding: 0 2px;
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
        margin-top: 8px;
        flex-shrink: 0;
        padding-bottom: 20px;
      }

      .resume-btn {
        padding: 14px 36px;
        font-size: 16px;
        font-weight: 700;
        border: none;
        border-radius: 50px;
        background: linear-gradient(135deg, #00ff88, #00cc66);
        color: #0a1015;
        cursor: pointer;
        transition: all 0.25s ease;
        letter-spacing: 1px;
        box-shadow: 0 4px 16px rgba(0, 255, 136, 0.35);
      }

      .resume-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0, 255, 136, 0.5);
      }

      .resume-btn:active {
        transform: translateY(0);
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

        .card-stats {
          grid-template-columns: 1fr;
          gap: 6px;
        }

        .upgrade-cost {
          text-align: left;
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

    const title = document.createElement('div');
    title.className = 'upgrade-title';
    title.textContent = '⚙️ Upgrades';

    this.pointsDisplay = document.createElement('div');
    this.pointsDisplay.className = 'upgrade-points';
    this.pointsDisplay.textContent = `⭐ 可用升级点: ${this.upgrades.getAvailablePoints()}`;

    header.appendChild(title);
    header.appendChild(this.pointsDisplay);
    container.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'upgrade-grid';

    UpgradeMenu.DISPLAY_ORDER.forEach((type) => {
      const card = this.createUpgradeCard(type);
      this.upgradeCards.set(type, card);
      grid.appendChild(card.card);
    });

    container.appendChild(grid);

    const resumeContainer = document.createElement('div');
    resumeContainer.className = 'resume-container';

    const resumeBtn = document.createElement('button');
    resumeBtn.className = 'resume-btn';
    resumeBtn.textContent = '▶ 返回战斗';
    resumeBtn.onclick = () => this.onResume();

    resumeContainer.appendChild(resumeBtn);
    container.appendChild(resumeContainer);

    return container;
  }

  private createUpgradeCard(type: UpgradeType): UpgradeCardElements {
    const card = document.createElement('div');
    card.className = 'upgrade-card';
    card.id = `upgrade-card-${type}`;

    const info = UpgradeMenu.UPGRADE_INFO[type];
    const config = UPGRADE_CONFIGS[type];
    const level = this.upgrades.getLevel(type);

    const header = document.createElement('div');
    header.className = 'card-header';

    const icon = document.createElement('span');
    icon.className = 'card-icon';
    icon.textContent = info.icon;

    const name = document.createElement('span');
    name.className = 'card-name';
    name.textContent = config.name;

    const dots = document.createElement('div');
    dots.className = 'level-dots';
    for (let i = 0; i < config.maxLevel; i++) {
      const dot = document.createElement('div');
      dot.className = 'level-dot';
      if (i < level) {
        dot.classList.add('filled');
      }
      dots.appendChild(dot);
    }

    header.appendChild(icon);
    header.appendChild(name);
    header.appendChild(dots);

    const description = document.createElement('div');
    description.className = 'card-desc';
    description.textContent = config.description;

    const stats = document.createElement('div');
    stats.className = 'card-stats';

    const currentStat = this.createStatItem('当前', 'current');
    const nextStat = this.createStatItem('下一级', 'next');
    const gainStat = this.createStatItem('每级收益', 'gain');

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
    card.appendChild(stats);
    card.appendChild(action);

    return {
      card,
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
    const canUpgrade = this.upgrades.canUpgrade(type);
    const isMaxed = level >= config.maxLevel;

    elements.card.classList.remove('upgradeable', 'maxed');
    if (isMaxed) {
      elements.card.classList.add('maxed');
    } else if (canUpgrade) {
      elements.card.classList.add('upgradeable');
    }

    const dots = elements.card.querySelectorAll('.level-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('filled', i < level);
    });

    const currentValue = this.upgrades.getValue(type);
    const nextValue = isMaxed ? currentValue : currentValue + config.valuePerLevel;

    elements.currentValue.textContent = this.formatValue(currentValue, config.unit);
    elements.nextValue.textContent = isMaxed
      ? 'MAX'
      : this.formatValue(nextValue, config.unit);
    elements.gainValue.textContent = this.formatDelta(config.valuePerLevel, config.unit, isMaxed);

    if (!isMaxed) {
      const cost = this.upgrades.getUpgradeCost(type);
      elements.cost.textContent = `花费: ⭐${cost}`;
    } else {
      elements.cost.textContent = '已满级';
    }

    elements.button.classList.remove('available', 'locked', 'maxed');
    elements.button.onclick = null as unknown as () => void;

    if (isMaxed) {
      elements.button.classList.add('maxed');
      elements.button.textContent = '✓ 已满级';
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
    elements.button.textContent = `升级点不足 (${this.upgrades.getUpgradeCost(type)}点)`;
  }

  private getUpgradeButtonLabel(cost: number): string {
    const isMobile = window.innerWidth <= 600;
    return isMobile ? `升级 (${cost}点)` : `立即升级 (${cost} 点)`;
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
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.upgradeCards.clear();
    this.pointsDisplay = null;
  }
}
