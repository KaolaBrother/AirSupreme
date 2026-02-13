import { GameConfig } from '@/config';

/**
 * 游戏界面 (HUD)
 */
export class HUD {
  private container: HTMLDivElement;
  private healthBarContainer: HTMLDivElement;
  private healthBarFill!: HTMLDivElement;
  private healthText: HTMLSpanElement;
  private scoreDisplay: HTMLDivElement;
  private speedDisplay: HTMLDivElement;
  private enemiesDisplay: HTMLDivElement;
  private remainingEnemiesDisplay: HTMLDivElement; // 剩余敌人数量
  private livesDisplay: HTMLDivElement;
  private missilesDisplay: HTMLDivElement;
  private powerUpDisplay: HTMLDivElement;  // 道具提示显示
  private gameOverDisplay: HTMLDivElement; // 游戏结束显示

  private powerUpTimer: number = 0;  // 道具提示显示计时器
  private activePowerUpDuration: number = 0;  // 道具持续时间

  constructor() {
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

    // 生命值条（改进版：更平衡的设计）
    this.healthBarContainer = this.createHealthBar(isMobile);
    this.healthText = this.createHealthText(isMobile);

    // 分数显示
    this.scoreDisplay = document.createElement('div');
    this.scoreDisplay.style.cssText = `
      font-size: ${fontSize};
      position: absolute;
      top: ${padding};
      right: ${padding};
    `;
    this.scoreDisplay.textContent = '分数: 0';

    // 剩余敌人数量显示（右上角）
    this.remainingEnemiesDisplay = document.createElement('div');
    this.remainingEnemiesDisplay.style.cssText = `
      font-size: ${isMobile ? '14px' : '18px'};
      position: absolute;
      top: ${isMobile ? '32px' : '45px'};
      right: ${padding};
      color: #ff4444;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
    `;
    this.remainingEnemiesDisplay.textContent = '剩余: 0';
    this.container.appendChild(this.remainingEnemiesDisplay);

    // 速度显示
    this.speedDisplay = document.createElement('div');
    this.speedDisplay.style.cssText = `
      font-size: ${isMobile ? '14px' : '18px'};
      position: absolute;
      bottom: ${isMobile ? '40%' : '20px'};
      left: ${padding};
    `;
    this.speedDisplay.textContent = '速度: 0 km/h';

    // 敌人数量显示
    this.enemiesDisplay = document.createElement('div');
    this.enemiesDisplay.style.cssText = `
      font-size: ${isMobile ? '14px' : '18px'};
      position: absolute;
      top: ${isMobile ? '54px' : '70px'};
      right: ${padding};
    `;
    this.enemiesDisplay.textContent = '敌人: 0';

    // 生命值显示（生命数）
    this.livesDisplay = document.createElement('div');
    this.livesDisplay.style.cssText = `
      font-size: ${isMobile ? '14px' : '18px'};
      position: absolute;
      top: ${isMobile ? '76px' : '95px'};
      right: ${padding};
    `;
    this.livesDisplay.textContent = '生命: ❤️❤️❤️';

    // 导弹数量显示
    this.missilesDisplay = document.createElement('div');
    this.missilesDisplay.style.cssText = `
      font-size: ${isMobile ? '14px' : '18px'};
      position: absolute;
      top: ${isMobile ? '98px' : '120px'};
      right: ${padding};
      color: #ff6600;
    `;
    this.missilesDisplay.textContent = '导弹: 🚀🚀';

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
    this.powerUpDisplay.textContent = '';

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
    this.gameOverDisplay.innerHTML = `
      <div style="
        text-align: center;
        color: #ff3333;
        font-size: ${isMobile ? '48px' : '72px'};
        font-weight: bold;
        text-shadow: 0 0 20px rgba(255, 0, 0, 0.8), 4px 4px 8px rgba(0, 0, 0, 1);
        margin-bottom: 30px;
        animation: pulse 1s ease-in-out infinite;
      ">GAME OVER</div>
      <div id="final-score" style="
        color: #ffdd00;
        font-size: ${isMobile ? '24px' : '36px'};
        font-weight: bold;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 1);
      "></div>
    `;

    this.container.appendChild(this.healthBarContainer);
    this.container.appendChild(this.healthText);
    this.container.appendChild(this.scoreDisplay);
    this.container.appendChild(this.speedDisplay);
    this.container.appendChild(this.enemiesDisplay);
    this.container.appendChild(this.livesDisplay);
    this.container.appendChild(this.missilesDisplay);
    this.container.appendChild(this.powerUpDisplay);
    document.body.appendChild(this.container);
    document.body.appendChild(this.gameOverDisplay);
  }

  /**
   * 创建血量文字显示
   */
  private createHealthText(isMobile: boolean): HTMLSpanElement {
    const text = document.createElement('span');
    text.className = 'health-text';
    text.style.cssText = `
      font-size: ${isMobile ? '18px' : '24px'};
      font-weight: bold;
      color: white;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      pointer-events: none;
    `;
    text.textContent = '100';
    return text;
  }

  /**
   * 创建生命值条（改进版：紧凑设计）
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

  /**
   * 更新生命值显示
   */
  public updateHealth(percent: number): void {
    // 更新血条填充宽度
    this.healthBarFill.style.width = `${percent * 100}%`;

    // 更新血量数字
    this.healthText.textContent = `${Math.ceil(percent * 100)}`;

    // 根据生命值改变颜色 - 4层渐变系统
    let gradient: string;
    let textColor: string = '#ffffff';

    if (percent > 0.6) {
      // 高血量：绿色渐变
      gradient = 'linear-gradient(90deg, #00ff66, #00ff33, #00cc00)';
    } else if (percent > 0.3) {
      // 中高血量：黄绿色渐变
      gradient = 'linear-gradient(90deg, #ffcc00, #ffdd00, #88aa00)';
      textColor = '#ffdd00';
    } else if (percent > 0.15) {
      // 低血量：橙色渐变
      gradient = 'linear-gradient(90deg, #ff9900, #ffcc00, #ffaa00)';
      textColor = '#ffaa00';
    } else {
      // 危低血量：红色渐变
      gradient = 'linear-gradient(90deg, #ff3300, #cc0000, #ff0000)';
      textColor = '#ff0000';
    }

    this.healthBarFill.style.background = gradient;
    this.healthText.style.color = textColor;
  }

  /**
   * 更新分数显示
   */
  public updateScore(score: number): void {
    this.scoreDisplay.textContent = `分数: ${score}`;
  }

  /**
   * 更新速度显示
   */
  public updateSpeed(speed: number): void {
    const displaySpeed = Math.round(speed * 10); // 放大显示
    this.speedDisplay.textContent = `速度: ${displaySpeed} km/h`;
  }

  /**
   * 更新敌人数量显示
   */
  public updateEnemies(count: number): void {
    this.enemiesDisplay.textContent = `敌人: ${count}`;
  }

  /**
   * 更新剩余敌人数量显示
   */
  public updateRemainingEnemies(count: number): void {
    this.remainingEnemiesDisplay.textContent = `剩余: ${count}`;
  }

  /**
   * 更新生命值显示
   */
  public updateLives(lives: number): void {
    const hearts = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
    this.livesDisplay.textContent = `生命: ${hearts}`;
  }

  /**
   * 更新导弹数量显示
   */
  public updateMissiles(count: number): void {
    const maxMissiles = 10; // 假设最多10发
    const icons = '🚀'.repeat(Math.max(0, count)) + '⬜'.repeat(Math.max(0, maxMissiles - count));
    this.missilesDisplay.textContent = `导弹: ${icons}`;
  }

  /**
   * 显示道具提示
   * @param name 道具名称
   * @param icon 道具图标
   * @param duration 持续时间（秒），0表示永久
   */
  public showPowerUp(name: string, icon: string, duration: number = 0): void {
    this.activePowerUpDuration = duration;
    this.powerUpDisplay.textContent = `${icon} ${name}`;
    this.powerUpDisplay.style.opacity = '1';

    // 如果有持续时间，显示倒计时
    if (duration > 0) {
      this.powerUpTimer = duration;
    }
  }

  /**
   * 更新道具倒计时
   */
  public update(deltaTime: number): void {
    // 更新道具倒计时
    if (this.activePowerUpDuration > 0 && this.powerUpTimer > 0) {
      this.powerUpTimer -= deltaTime;
      if (this.powerUpTimer <= 0) {
        // 时间到，隐藏道具提示
        this.hidePowerUp();
      }
    }
  }

  /**
   * 隐藏道具提示
   */
  public hidePowerUp(): void {
    this.powerUpDisplay.style.opacity = '0';
    this.activePowerUpDuration = 0;
    this.powerUpTimer = 0;
  }

  /**
   * 隐藏 HUD
   */
  public hide(): void {
    this.container.style.display = 'none';
  }

  /**
   * 显示 HUD
   */
  public show(): void {
    this.container.style.display = 'block';
  }

  /**
   * 显示游戏结束
   */
  public showGameOver(finalScore: number): void {
    const scoreElement = this.gameOverDisplay.querySelector('#final-score');
    if (scoreElement) {
      scoreElement.textContent = `最终得分: ${finalScore}`;
    }
    this.gameOverDisplay.style.opacity = '1';
    this.gameOverDisplay.style.pointerEvents = 'auto';
  }

  /**
   * 隐藏游戏结束
   */
  public hideGameOver(): void {
    this.gameOverDisplay.style.opacity = '0';
    this.gameOverDisplay.style.pointerEvents = 'none';
  }
}
