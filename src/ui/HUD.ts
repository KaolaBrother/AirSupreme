import { GameConfig } from '@/config';

type BigMessageVariant = 'announcement' | 'powerup';

/**
 * 游戏界面 (HUD)
 */
export class HUD {
  private static readonly UPGRADE_HINT_STYLE_ID = 'hud-upgrade-hint-style';
  private container: HTMLDivElement;
  private healthBarContainer: HTMLDivElement;
  private healthBarFill!: HTMLDivElement;
  private scoreDisplay: HTMLDivElement;
  private speedDisplay: HTMLDivElement;
  private enemiesDisplay: HTMLDivElement;
  private remainingEnemiesDisplay: HTMLDivElement; // 剩余敌人数量
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
  private finalScoreDisplay: HTMLDivElement;
  private upgradePointsDisplay: HTMLDivElement;

  private powerUpTimer: number = 0;
  private activePowerUpDuration: number = 0; // 道具持续时间
  private powerUpBigTimer: number = 0; // 大字提示显示计时器
  private activePowerUpName: string = '';
  private activePowerUpIcon: string = '';
  private lastPowerUpRemainingSeconds: number = -1;
  private readonly textContentCache = new WeakMap<HTMLElement, string>();
  private readonly styleValueCache = new WeakMap<HTMLElement, Map<string, string>>();

  constructor() {
    this.ensureUpgradeHintStyle();
    this.container = document.createElement('div');
    this.container.id = 'hud';

    const isMobile = GameConfig.isMobile;
    const padding = isMobile ? '10px' : '20px';
    const fontSize = isMobile ? '16px' : '20px';

    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      padding: ${padding};
      pointer-events: none;
      font-family: 'Arial', sans-serif;
      color: white;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      z-index: 50;
    `;

    this.healthBarContainer = this.createHealthBar(isMobile);

    this.upgradePointsDisplay = document.createElement('div');
    this.upgradePointsDisplay.style.cssText = `
      font-size: ${isMobile ? '14px' : '18px'};
      position: absolute;
      top: ${isMobile ? '25px' : '40px'};
      left: ${padding};
      color: #FFD700;
      background: rgba(20, 24, 32, 0.75);
      border: 1px solid rgba(255, 215, 0, 0.45);
      border-radius: 8px;
      padding: ${isMobile ? '4px 8px' : '5px 10px'};
      text-shadow: 0 0 8px rgba(255, 215, 0, 0.35);
      display: none;
    `;
    this.setTextContent(this.upgradePointsDisplay, '⭐ 0');

    this.scoreDisplay = document.createElement('div');
    this.scoreDisplay.style.cssText = `
      font-size: ${fontSize};
      position: absolute;
      top: ${isMobile ? '50px' : '70px'};
      left: ${padding};
    `;
    this.setTextContent(this.scoreDisplay, '分数: 0');

    this.speedDisplay = document.createElement('div');
    this.speedDisplay.style.cssText = `
      font-size: ${isMobile ? '14px' : '18px'};
      position: absolute;
      top: ${isMobile ? '75px' : '100px'};
      left: ${padding};
    `;
    this.setTextContent(this.speedDisplay, '速度: 0 km/h');

    this.remainingEnemiesDisplay = document.createElement('div');
    this.remainingEnemiesDisplay.style.cssText = `
      font-size: ${isMobile ? '14px' : '18px'};
      position: absolute;
      top: ${isMobile ? '32px' : '45px'};
      right: ${padding};
      color: #ff4444;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
    `;
    this.setTextContent(this.remainingEnemiesDisplay, '剩余: 0');
    this.container.appendChild(this.remainingEnemiesDisplay);
    this.container.appendChild(this.upgradePointsDisplay);
    this.container.appendChild(this.speedDisplay);

    this.enemiesDisplay = document.createElement('div');
    this.enemiesDisplay.style.cssText = `
      font-size: ${isMobile ? '14px' : '18px'};
      position: absolute;
      top: ${isMobile ? '54px' : '70px'};
      right: ${padding};
    `;
    this.setTextContent(this.enemiesDisplay, '敌人: 0');

    // 生命值显示（生命数）
    this.livesDisplay = document.createElement('div');
    this.livesDisplay.style.cssText = `
      font-size: ${isMobile ? '14px' : '18px'};
      position: absolute;
      top: ${isMobile ? '76px' : '95px'};
      right: ${padding};
    `;
    this.setTextContent(this.livesDisplay, '生命: ❤️❤️❤️');

    // 导弹数量显示
    this.missilesDisplay = document.createElement('div');
    this.missilesDisplay.style.cssText = `
      font-size: ${isMobile ? '14px' : '18px'};
      position: absolute;
      top: ${isMobile ? '98px' : '120px'};
      right: ${padding};
      color: #ff6600;
    `;
    this.setTextContent(this.missilesDisplay, '导弹: 🚀🚀');

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
      font-size: ${isMobile ? '120px' : '150px'};
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

    // 游戏结束显示（居中覆盖层）
    this.gameOverDisplay = document.createElement('div');
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
      z-index: 100;
      opacity: 0;
      transition: opacity 0.5s;
      pointer-events: none;
    `;
    const gameOverTitle = document.createElement('div');
    gameOverTitle.style.cssText = `
      text-align: center;
      color: #ff3333;
      font-size: ${isMobile ? '48px' : '72px'};
      font-weight: bold;
      text-shadow: 0 0 20px rgba(255, 0, 0, 0.8), 4px 4px 8px rgba(0, 0, 0, 1);
      margin-bottom: 30px;
      animation: pulse 1s ease-in-out infinite;
    `;
    this.setTextContent(gameOverTitle, 'GAME OVER');

    this.finalScoreDisplay = document.createElement('div');
    this.finalScoreDisplay.id = 'final-score';
    this.finalScoreDisplay.style.cssText = `
      color: #ffdd00;
      font-size: ${isMobile ? '24px' : '36px'};
      font-weight: bold;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 1);
    `;

    this.gameOverDisplay.appendChild(gameOverTitle);
    this.gameOverDisplay.appendChild(this.finalScoreDisplay);

    this.container.appendChild(this.healthBarContainer);
    this.container.appendChild(this.scoreDisplay);
    this.container.appendChild(this.enemiesDisplay);
    this.container.appendChild(this.livesDisplay);
    this.container.appendChild(this.missilesDisplay);
    this.container.appendChild(this.missileProgressDisplay);
    this.container.appendChild(this.powerUpDisplay);
    document.body.appendChild(this.container);
    document.body.appendChild(this.powerUpBigDisplay);
    document.body.appendChild(this.gameOverDisplay);
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
      background: linear-gradient(90deg, #00ff66, #00ff33, #00cc00);
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
    const clampedPercent = Math.max(0, Math.min(1, percent));
    this.setStyleValue(this.healthBarFill, 'width', `${clampedPercent * 100}%`);

    let gradient: string;

    if (clampedPercent > 0.6) {
      gradient = 'linear-gradient(90deg, #00ff66, #00ff33, #00cc00)';
    } else if (clampedPercent > 0.3) {
      gradient = 'linear-gradient(90deg, #ffcc00, #ffdd00, #88aa00)';
    } else if (clampedPercent > 0.15) {
      gradient = 'linear-gradient(90deg, #ff9900, #ffcc00, #ffaa00)';
    } else {
      gradient = 'linear-gradient(90deg, #ff3300, #cc0000, #ff0000)';
    }

    this.setStyleValue(this.healthBarFill, 'background', gradient);
  }

  /**
   * 更新分数显示
   */
  public updateScore(score: number): void {
    this.setTextContent(this.scoreDisplay, `分数: ${score}`);
  }

  /**
   * 更新速度显示
   */
  public updateSpeed(speed: number): void {
    const displaySpeed = Math.round(speed * 10); // 放大显示
    this.setTextContent(this.speedDisplay, `速度: ${displaySpeed} km/h`);
  }

  /**
   * 更新敌人数量显示
   */
  public updateEnemies(count: number): void {
    this.setTextContent(this.enemiesDisplay, `敌人: ${count}`);
  }

  /**
   * 更新剩余敌人数量显示
   */
  public updateRemainingEnemies(count: number): void {
    this.setTextContent(this.remainingEnemiesDisplay, `剩余: ${count}`);
  }

  /**
   * 更新生命值显示
   */
  public updateLives(lives: number): void {
    const hearts = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
    this.setTextContent(this.livesDisplay, `生命: ${hearts}`);
  }

  public updateUpgradePoints(points: number): void {
    if (points > 0) {
      const isMobile = GameConfig.isMobile;
      const hintText = isMobile
        ? `⭐ 可升级 ${points} 点`
        : `⭐ 可升级 ${points} 点 · 按 U 打开`;
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
    const maxMissiles = 10; // 假设最多10发
    const icons = '🚀'.repeat(Math.max(0, count)) + '⬜'.repeat(Math.max(0, maxMissiles - count));
    this.setTextContent(this.missilesDisplay, `导弹: ${icons}`);
  }

  /**
   * 更新导弹补给进度条
   * @param progress 进度（0-1）
   */
  public updateMissileProgress(progress: number): void {
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
  }

  /**
   * 隐藏道具提示
   */
  public hidePowerUp(): void {
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
   * @param minDisplayTime 最小显示时间（秒），默认1秒
   * @param hideSubtext 是否隐藏副标题，默认false
   */
  public showPowerUpBig(
    icon: string,
    name: string,
    minDisplayTime: number = 1,
    hideSubtext: boolean = false,
    variant: BigMessageVariant = 'announcement'
  ): void {
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
    this.setStyleValue(this.container, 'display', 'none');
  }

  /**
   * 显示 HUD
   */
  public show(): void {
    this.setStyleValue(this.container, 'display', 'block');
  }

  /**
   * 显示游戏结束
   */
  public showGameOver(finalScore: number): void {
    this.setTextContent(this.finalScoreDisplay, `最终得分: ${finalScore}`);
    this.setStyleValue(this.gameOverDisplay, 'opacity', '1');
    this.setStyleValue(this.gameOverDisplay, 'pointerEvents', 'auto');
  }

  /**
   * 隐藏游戏结束
   */
  public hideGameOver(): void {
    this.setStyleValue(this.gameOverDisplay, 'opacity', '0');
    this.setStyleValue(this.gameOverDisplay, 'pointerEvents', 'none');
  }

  public dispose(): void {
    this.container.remove();
    this.powerUpBigDisplay.remove();
    this.gameOverDisplay.remove();
  }
}
