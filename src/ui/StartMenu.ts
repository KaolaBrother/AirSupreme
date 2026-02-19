import { ModelPreview } from './ModelPreview';

export class StartMenu {
  private container: HTMLDivElement;
  private settingsContainer: HTMLDivElement;
  private onStart?: (settings: GameSettings) => void;
  private modelPreview: ModelPreview;

  private settings: GameSettings = {
    difficulty: 1,
    soundVolume: 0.7,
    playerLives: 3,
    startLevel: 1,
    gameMode: 'normal',
    testScore: 0,
  };

  constructor() {
    this.modelPreview = new ModelPreview();
    this.modelPreview.setOnBack(() => {
      this.container.style.display = 'flex';
    });
    this.container = this.createContainer();
    this.settingsContainer = this.createSettingsPanel();
    this.container.appendChild(this.settingsContainer);
    document.body.appendChild(this.container);
  }

  private createContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'start-menu';
    container.innerHTML = `
      <style>
        #start-menu {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 20px;
          overflow-y: auto;
          z-index: 1000;
          font-family: 'Arial', sans-serif;
          color: white;
        }

        .menu-title {
          font-size: 72px;
          font-weight: bold;
          margin-bottom: 10px;
          text-shadow: 0 0 20px rgba(100, 200, 255, 0.8),
                       0 0 40px rgba(100, 200, 255, 0.5);
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }

        .menu-subtitle {
          font-size: 24px;
          opacity: 0.8;
          margin-bottom: 40px;
        }

        .settings-panel {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 15px;
          padding: 30px 40px;
          margin-bottom: 30px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          min-width: 400px;
        }

        .setting-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 15px 0;
        }

        .setting-label {
          font-size: 18px;
        }

        .setting-control {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .setting-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.5);
          background: rgba(255, 255, 255, 0.1);
          color: white;
          font-size: 20px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .setting-btn:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: scale(1.1);
        }

        .setting-value {
          font-size: 20px;
          font-weight: bold;
          min-width: 60px;
          text-align: center;
        }

        .start-btn {
          padding: 20px 40px;
          font-size: 24px;
          font-weight: bold;
          border: none;
          border-radius: 50px;
          background: linear-gradient(135deg, #4CAF50, #45a049);
          color: white;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 5px 20px rgba(76, 175, 80, 0.4);
        }

        .start-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 30px rgba(76, 175, 80, 0.6);
        }

        .button-container {
          display: flex;
          gap: 20px;
          justify-content: center;
          margin-bottom: 30px;
        }

        .preview-btn {
          padding: 20px 40px;
          font-size: 24px;
          font-weight: bold;
          border: none;
          border-radius: 50px;
          background: linear-gradient(135deg, #2196F3, #1976D2);
          color: white;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 5px 15px rgba(33, 150, 243, 0.4);
        }

        .preview-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(33, 150, 243, 0.6);
        }

        .controls-info {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 10px;
          padding: 20px 30px;
          text-align: left;
        }

        .controls-title {
          font-size: 20px;
          margin-bottom: 15px;
          text-align: center;
        }

        .control-row {
          display: flex;
          justify-content: space-between;
          margin: 8px 0;
          font-size: 16px;
        }

        .key {
          background: rgba(255, 255, 255, 0.2);
          padding: 3px 10px;
          border-radius: 5px;
          font-family: monospace;
        }

        .mobile-controls-info {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid rgba(255, 255, 255, 0.2);
        }

        #start-menu::-webkit-scrollbar {
          width: 8px;
        }

        #start-menu::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }

        #start-menu::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 4px;
        }

        #start-menu::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }
      </style>

      <div class="menu-title">✈️ Air Supreme</div>
      <div class="menu-subtitle">3D 空战游戏</div>
    `;
    return container;
  }

  private createSettingsPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'settings-panel';

    // 难度设置
    const difficultyRow = this.createSettingRow(
      '难度',
      this.getDifficultyText(this.settings.difficulty),
      () => {
        this.settings.difficulty = Math.max(1, this.settings.difficulty - 1);
        this.updateDisplay();
      },
      () => {
        this.settings.difficulty = Math.min(5, this.settings.difficulty + 1);
        this.updateDisplay();
      }
    );
    difficultyRow.id = 'difficulty-row';

    // 音量设置
    const soundRow = this.createSettingRow(
      '音效音量',
      `${Math.round(this.settings.soundVolume * 100)}%`,
      () => {
        this.settings.soundVolume = Math.max(0, this.settings.soundVolume - 0.1);
        this.updateDisplay();
      },
      () => {
        this.settings.soundVolume = Math.min(1, this.settings.soundVolume + 0.1);
        this.updateDisplay();
      }
    );
    soundRow.id = 'sound-row';

    // 生命值设置
    const livesRow = this.createSettingRow(
      '生命数',
      `${this.settings.playerLives}`,
      () => {
        this.settings.playerLives = Math.max(1, this.settings.playerLives - 1);
        this.updateDisplay();
      },
      () => {
        this.settings.playerLives = Math.min(9, this.settings.playerLives + 1);
        this.updateDisplay();
      }
    );
    livesRow.id = 'lives-row';

    // 选关设置
    const levelRow = this.createSettingRow(
      '起始关卡',
      `第${this.settings.startLevel}关`,
      () => {
        this.settings.startLevel = Math.max(1, this.settings.startLevel - 1);
        this.updateDisplay();
      },
      () => {
        this.settings.startLevel = Math.min(5, this.settings.startLevel + 1);
        this.updateDisplay();
      }
    );
    levelRow.id = 'level-row';

    panel.appendChild(difficultyRow);
    panel.appendChild(soundRow);
    panel.appendChild(livesRow);
    panel.appendChild(levelRow);

    // 游戏模式选择
    const modeRow = this.createSettingRow(
      '游戏模式',
      this.settings.gameMode === 'normal' ? '普通模式' : 'Boss 模式',
      () => {
        this.settings.gameMode = this.settings.gameMode === 'normal' ? 'boss' : 'normal';
        this.updateDisplay();
      },
      () => {
        this.settings.gameMode = this.settings.gameMode === 'normal' ? 'boss' : 'normal';
        this.updateDisplay();
      }
    );
    modeRow.id = 'mode-row';
    panel.appendChild(modeRow);

    const testScoreValues = [0, 2000, 3000, 4000, 5000];
    const testScoreRow = this.createSettingRow(
      '测试分数',
      this.settings.testScore === 0 ? '关闭' : `${this.settings.testScore}`,
      () => {
        const currentIndex = testScoreValues.indexOf(this.settings.testScore);
        this.settings.testScore = testScoreValues[Math.max(0, currentIndex - 1)];
        this.updateDisplay();
      },
      () => {
        const currentIndex = testScoreValues.indexOf(this.settings.testScore);
        this.settings.testScore =
          testScoreValues[Math.min(testScoreValues.length - 1, currentIndex + 1)];
        this.updateDisplay();
      }
    );
    testScoreRow.id = 'testscore-row';
    panel.appendChild(testScoreRow);

    // 按钮容器 - 并排放置
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';

    // 开始按钮
    const startBtn = document.createElement('button');
    startBtn.className = 'start-btn';
    startBtn.textContent = this.settings.gameMode === 'normal' ? '🎮 开始游戏' : '👹 Boss 挑战';
    startBtn.id = 'start-btn';
    startBtn.onclick = () => this.startGame();
    buttonContainer.appendChild(startBtn);

    // 模型预览按钮
    const previewBtn = document.createElement('button');
    previewBtn.className = 'preview-btn';
    previewBtn.innerHTML = '✈️ 模型预览';
    previewBtn.onclick = () => {
      this.container.style.display = 'none';
      this.modelPreview.show();
    };
    buttonContainer.appendChild(previewBtn);

    panel.appendChild(buttonContainer);

    // 控制说明
    const controlsInfo = document.createElement('div');
    controlsInfo.className = 'controls-info';
    controlsInfo.innerHTML = `
      <div class="controls-title">📖 控制说明</div>
      <div class="control-row">
        <span><span class="key">W</span> / <span class="key">S</span></span>
        <span>俯仰（机头上下）</span>
      </div>
      <div class="control-row">
        <span><span class="key">A</span> / <span class="key">D</span></span>
        <span>偏航（机头左右）</span>
      </div>
      <div class="control-row">
        <span><span class="key">Q</span> / <span class="key">E</span></span>
        <span>翻滚（机翼倾斜）</span>
      </div>
      <div class="control-row">
        <span><span class="key">空格</span></span>
        <span>开火</span>
      </div>
      <div class="control-row">
        <span><span class="key">Shift</span></span>
        <span>加速</span>
      </div>
      <div class="mobile-controls-info">
        📱 移动端：使用虚拟摇杆和按钮控制
      </div>
    `;
    panel.appendChild(controlsInfo);

    return panel;
  }

  private createSettingRow(
    label: string,
    initialValue: string,
    onDecrease: () => void,
    onIncrease: () => void
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'setting-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'setting-label';
    labelEl.textContent = label;

    const control = document.createElement('div');
    control.className = 'setting-control';

    const decreaseBtn = document.createElement('button');
    decreaseBtn.className = 'setting-btn';
    decreaseBtn.textContent = '-';
    decreaseBtn.onclick = onDecrease;

    const valueEl = document.createElement('span');
    valueEl.className = 'setting-value';
    valueEl.textContent = initialValue;
    valueEl.id = `${label.toLowerCase()}-value`;

    const increaseBtn = document.createElement('button');
    increaseBtn.className = 'setting-btn';
    increaseBtn.textContent = '+';
    increaseBtn.onclick = onIncrease;

    control.appendChild(decreaseBtn);
    control.appendChild(valueEl);
    control.appendChild(increaseBtn);

    row.appendChild(labelEl);
    row.appendChild(control);

    return row;
  }

  private getDifficultyText(level: number): string {
    const texts = ['简单', '普通', '困难', '专家', '地狱'];
    return texts[level - 1];
  }

  private updateDisplay(): void {
    const difficultyValue =
      document.getElementById('难度-value') ||
      document.querySelector('#difficulty-row .setting-value');
    const soundValue =
      document.getElementById('音效音量-value') ||
      document.querySelector('#sound-row .setting-value');
    const livesValue =
      document.getElementById('生命数-value') ||
      document.querySelector('#lives-row .setting-value');
    const levelValue =
      document.getElementById('起始关卡-value') ||
      document.querySelector('#level-row .setting-value');
    const modeValue =
      document.getElementById('游戏模式-value') ||
      document.querySelector('#mode-row .setting-value');
    const testScoreValue =
      document.getElementById('测试分数-value') ||
      document.querySelector('#testscore-row .setting-value');
    const startBtn = document.getElementById('start-btn');

    if (difficultyValue)
      difficultyValue.textContent = this.getDifficultyText(this.settings.difficulty);
    if (soundValue) soundValue.textContent = `${Math.round(this.settings.soundVolume * 100)}%`;
    if (livesValue) livesValue.textContent = `${this.settings.playerLives}`;
    if (levelValue) levelValue.textContent = `第${this.settings.startLevel}关`;
    if (modeValue)
      modeValue.textContent = this.settings.gameMode === 'normal' ? '普通模式' : 'Boss 模式';
    if (testScoreValue)
      testScoreValue.textContent =
        this.settings.testScore === 0 ? '关闭' : `${this.settings.testScore}`;
    if (startBtn)
      startBtn.textContent = this.settings.gameMode === 'normal' ? '🎮 开始游戏' : '👹 Boss 挑战';
  }

  private startGame(): void {
    this.container.style.display = 'none';
    this.onStart?.(this.settings);
  }

  public setOnStart(callback: (settings: GameSettings) => void): void {
    this.onStart = callback;
  }

  public show(): void {
    this.container.style.display = 'flex';
  }

  public hide(): void {
    this.container.style.display = 'none';
  }
}

export interface GameSettings {
  difficulty: number;
  soundVolume: number;
  playerLives: number;
  startLevel: number;
  gameMode: 'normal' | 'boss';
  testScore: number;
}
