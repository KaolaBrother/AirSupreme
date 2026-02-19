import { UpgradeType, PlayerUpgrades, UPGRADE_CONFIGS } from '@/features/upgrade/UpgradeSystem';

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
  private upgradeCards: Map<UpgradeType, HTMLDivElement> = new Map();
  private pointsDisplay: HTMLDivElement | null = null;

  private static readonly UPGRADE_INFO: Record<UpgradeType, { icon: string; label: string }> = {
    [UpgradeType.MAX_HEALTH]: { icon: '❤️', label: 'HP' },
    [UpgradeType.SPEED]: { icon: '⚡', label: 'Speed' },
    [UpgradeType.FIRE_RATE]: { icon: '🔫', label: 'Fire Rate' },
    [UpgradeType.DAMAGE]: { icon: '💥', label: 'Damage' },
    [UpgradeType.MISSILE_RELOAD_TIME]: { icon: '🚀', label: 'Missile Reload' },
    [UpgradeType.MISSILE_LOCK_TIME]: { icon: '🎯', label: 'Missile Lock' },
  };

  private static readonly DISPLAY_ORDER: UpgradeType[] = [
    UpgradeType.MAX_HEALTH,
    UpgradeType.SPEED,
    UpgradeType.FIRE_RATE,
    UpgradeType.DAMAGE,
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
    if (!this.container) {
      this.container = this.createContainer();
      document.body.appendChild(this.container);
    }
    this.updateDisplay();
    this.container.style.display = 'flex';
    this.visible = true;
  }

  public hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }
    this.visible = false;
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public updateDisplay(): void {
    if (!this.container) return;

    if (this.pointsDisplay) {
      this.pointsDisplay.textContent = `⭐ ${this.upgrades.getAvailablePoints()}`;
    }

    UpgradeMenu.DISPLAY_ORDER.forEach((type) => {
      this.updateUpgradeCard(type);
    });
  }

  private createContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'upgrade-menu';
    container.innerHTML = `
      <style>
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
          font-size: 28px;
          font-weight: 600;
          color: #ffd700;
          text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
        }

        .upgrade-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          max-width: 700px;
          width: 100%;
          margin-bottom: 24px;
        }

        @media (max-width: 600px) {
          .upgrade-grid {
            grid-template-columns: 1fr;
          }
        }

        .upgrade-card {
          background: linear-gradient(145deg, rgba(30, 40, 55, 0.9), rgba(20, 25, 35, 0.95));
          border: 2px solid rgba(100, 120, 140, 0.3);
          border-radius: 12px;
          padding: 16px;
          transition: all 0.3s ease;
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
          box-shadow: 0 0 20px rgba(0, 255, 136, 0.2), inset 0 0 30px rgba(0, 255, 136, 0.05);
        }

        .upgrade-card.upgradeable::before {
          background: linear-gradient(90deg, transparent, #00ff88, transparent);
        }

        .upgrade-card.maxed {
          border-color: #ffd700;
          opacity: 0.8;
        }

        .upgrade-card.maxed::before {
          background: linear-gradient(90deg, transparent, #ffd700, transparent);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }

        .card-icon {
          font-size: 28px;
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
          gap: 6px;
        }

        .level-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: rgba(100, 120, 140, 0.3);
          border: 1px solid rgba(100, 120, 140, 0.5);
          transition: all 0.3s ease;
        }

        .level-dot.filled {
          background: linear-gradient(135deg, #00ff88, #00ccff);
          border-color: #00ff88;
          box-shadow: 0 0 8px rgba(0, 255, 136, 0.5);
        }

        .card-stats {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding: 0 4px;
        }

        .current-value {
          font-size: 14px;
          color: #8899aa;
        }

        .current-value span {
          color: #00ccff;
          font-weight: 600;
          font-size: 16px;
        }

        .upgrade-cost {
          font-size: 14px;
          color: #ffd700;
        }

        .card-action {
          display: flex;
          justify-content: center;
        }

        .upgrade-btn {
          width: 100%;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 600;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .upgrade-btn.available {
          background: linear-gradient(135deg, #0088ff, #00ccff);
          color: white;
          box-shadow: 0 4px 15px rgba(0, 136, 255, 0.4);
        }

        .upgrade-btn.available:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 136, 255, 0.6);
        }

        .upgrade-btn.available:active {
          transform: translateY(0);
        }

        .upgrade-btn.locked {
          background: rgba(60, 70, 80, 0.6);
          color: #556677;
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
          padding: 16px 48px;
          font-size: 18px;
          font-weight: 700;
          border: none;
          border-radius: 50px;
          background: linear-gradient(135deg, #00ff88, #00cc66);
          color: #0a1015;
          cursor: pointer;
          transition: all 0.3s ease;
          text-transform: uppercase;
          letter-spacing: 2px;
          box-shadow: 0 4px 20px rgba(0, 255, 136, 0.4);
        }

        .resume-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 30px rgba(0, 255, 136, 0.6);
        }

        .resume-btn:active {
          transform: translateY(-1px);
        }
      </style>
    `;

    const header = document.createElement('div');
    header.className = 'upgrade-header';

    const title = document.createElement('div');
    title.className = 'upgrade-title';
    title.textContent = '⚙️ Upgrades';

    this.pointsDisplay = document.createElement('div');
    this.pointsDisplay.className = 'upgrade-points';
    this.pointsDisplay.textContent = `⭐ ${this.upgrades.getAvailablePoints()}`;

    header.appendChild(title);
    header.appendChild(this.pointsDisplay);
    container.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'upgrade-grid';

    UpgradeMenu.DISPLAY_ORDER.forEach((type) => {
      const card = this.createUpgradeCard(type);
      this.upgradeCards.set(type, card);
      grid.appendChild(card);
    });

    container.appendChild(grid);

    const resumeContainer = document.createElement('div');
    resumeContainer.className = 'resume-container';

    const resumeBtn = document.createElement('button');
    resumeBtn.className = 'resume-btn';
    resumeBtn.textContent = '▶ Resume';
    resumeBtn.onclick = () => this.onResume();

    resumeContainer.appendChild(resumeBtn);
    container.appendChild(resumeContainer);

    return container;
  }

  private createUpgradeCard(type: UpgradeType): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'upgrade-card';
    card.id = `upgrade-card-${type}`;

    const info = UpgradeMenu.UPGRADE_INFO[type];
    const config = UPGRADE_CONFIGS[type];
    const level = this.upgrades.getLevel(type);
    const canUpgrade = this.upgrades.canUpgrade(type);
    const isMaxed = level >= config.maxLevel;

    if (isMaxed) {
      card.classList.add('maxed');
    } else if (canUpgrade) {
      card.classList.add('upgradeable');
    }

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

    const stats = document.createElement('div');
    stats.className = 'card-stats';

    const currentValue = document.createElement('div');
    currentValue.className = 'current-value';
    const value = this.upgrades.getValue(type);
    const formattedValue = this.formatValue(value, config.unit);
    currentValue.innerHTML = `当前: <span>${formattedValue}</span>`;

    const costDisplay = document.createElement('div');
    costDisplay.className = 'upgrade-cost';
    costDisplay.id = `cost-${type}`;
    if (!isMaxed) {
      const cost = this.upgrades.getUpgradeCost(type);
      costDisplay.textContent = `花费: ⭐${cost}`;
    } else {
      costDisplay.textContent = '已满级';
    }

    stats.appendChild(currentValue);
    stats.appendChild(costDisplay);

    const action = document.createElement('div');
    action.className = 'card-action';

    const btn = document.createElement('button');
    btn.className = 'upgrade-btn';
    btn.id = `btn-${type}`;

    if (isMaxed) {
      btn.classList.add('maxed');
      btn.textContent = '✓ Maxed';
    } else if (canUpgrade) {
      btn.classList.add('available');
      btn.textContent = 'Upgrade';
      btn.onclick = () => {
        this.onUpgrade(type);
        this.updateDisplay();
      };
    } else {
      btn.classList.add('locked');
      btn.textContent = 'Upgrade';
    }

    action.appendChild(btn);

    card.appendChild(header);
    card.appendChild(stats);
    card.appendChild(action);

    return card;
  }

  private updateUpgradeCard(type: UpgradeType): void {
    const card = this.upgradeCards.get(type);
    if (!card) return;

    const config = UPGRADE_CONFIGS[type];
    const level = this.upgrades.getLevel(type);
    const canUpgrade = this.upgrades.canUpgrade(type);
    const isMaxed = level >= config.maxLevel;

    card.classList.remove('upgradeable', 'maxed');
    if (isMaxed) {
      card.classList.add('maxed');
    } else if (canUpgrade) {
      card.classList.add('upgradeable');
    }

    const dots = card.querySelectorAll('.level-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('filled', i < level);
    });

    const value = this.upgrades.getValue(type);
    const formattedValue = this.formatValue(value, config.unit);
    const currentValueEl = card.querySelector('.current-value');
    if (currentValueEl) {
      currentValueEl.innerHTML = `当前: <span>${formattedValue}</span>`;
    }

    const costDisplay = card.querySelector(`#cost-${type}`) as HTMLDivElement;
    if (costDisplay) {
      if (!isMaxed) {
        const cost = this.upgrades.getUpgradeCost(type);
        costDisplay.textContent = `花费: ⭐${cost}`;
      } else {
        costDisplay.textContent = '已满级';
      }
    }

    const btn = card.querySelector(`#btn-${type}`) as HTMLButtonElement;
    if (btn) {
      btn.classList.remove('available', 'locked', 'maxed');
      btn.onclick = null as unknown as () => void;

      if (isMaxed) {
        btn.classList.add('maxed');
        btn.textContent = '✓ Maxed';
      } else if (canUpgrade) {
        btn.classList.add('available');
        btn.textContent = 'Upgrade';
        btn.onclick = () => {
          this.onUpgrade(type);
          this.updateDisplay();
        };
      } else {
        btn.classList.add('locked');
        btn.textContent = 'Upgrade';
      }
    }
  }

  private formatValue(value: number, unit: string): string {
    // 对于负数增益（如减少时间），显示正值
    const displayValue = value < 0 ? -value : value;
    const rounded = Math.round(displayValue * 10) / 10;
    return unit ? `${rounded}${unit}` : `${rounded}`;
  }

  public dispose(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.upgradeCards.clear();
    this.pointsDisplay = null;
  }
}
