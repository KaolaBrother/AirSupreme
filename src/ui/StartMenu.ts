import { type QualityPreset } from '@/config';
import {
  DEFAULT_START_FLOW_SETTINGS,
  getAudioSettings,
  getPresentationSettings,
  loadStartFlowSettings,
  saveStartFlowSettings,
  TEST_SCORE_OPTIONS,
  type StartFlowSettings,
} from '@/core/SessionSettings';
import type { ModelPreview } from './ModelPreview';
type ModelPreviewModule = typeof import('./ModelPreview');

export class StartMenu {
  private container: HTMLDivElement;
  private settingsContainer: HTMLDivElement;
  private onStart?: (settings: GameSettings) => void;
  private modelPreview: ModelPreview | null = null;
  private modelPreviewPromise: Promise<ModelPreview> | null = null;
  private modelPreviewModulePromise: Promise<ModelPreviewModule> | null = null;
  private isDisposed: boolean = false;

  private settings: GameSettings = { ...DEFAULT_START_FLOW_SETTINGS };

  constructor() {
    this.loadSettings();
    this.container = this.createContainer();
    this.settingsContainer = this.createSettingsPanel();
    this.container.appendChild(this.settingsContainer);
    document.body.appendChild(this.container);
    this.scheduleModelPreviewPreload();
  }

  private scheduleModelPreviewPreload(): void {
    const preload = (): void => {
      if (this.isDisposed) {
        return;
      }
      this.preloadModelPreviewModule();
    };

    if ('requestIdleCallback' in window) {
      (
        window as Window & {
          requestIdleCallback: (callback: IdleRequestCallback) => number;
        }
      ).requestIdleCallback(() => preload());
      return;
    }

    setTimeout(preload, 1200);
  }

  private preloadModelPreviewModule(): void {
    if (this.modelPreview || this.modelPreviewPromise || this.modelPreviewModulePromise) {
      return;
    }

    this.modelPreviewModulePromise = import('./ModelPreview').catch((error) => {
      this.modelPreviewModulePromise = null;
      throw error;
    });
  }

  private async ensureModelPreview(): Promise<ModelPreview> {
    if (this.modelPreview) {
      return this.modelPreview;
    }

    if (!this.modelPreviewPromise) {
      const modulePromise = this.modelPreviewModulePromise ?? import('./ModelPreview');
      this.modelPreviewModulePromise = modulePromise;
      this.modelPreviewPromise = modulePromise.then(({ ModelPreview }) => {
        const preview = new ModelPreview();
        preview.setOnBack(() => {
          if (!this.isDisposed) {
            this.container.style.display = 'flex';
          }
        });

        if (this.isDisposed) {
          preview.dispose();
          throw new Error('StartMenu 已销毁，取消模型预览初始化');
        }

        this.modelPreview = preview;
        return preview;
      });
    }

    try {
      return await this.modelPreviewPromise;
    } catch (error) {
      this.modelPreviewPromise = null;
      this.modelPreviewModulePromise = null;
      throw error;
    }
  }

  private loadSettings(): void {
    this.settings = loadStartFlowSettings();
  }

  private saveSettings(): void {
    saveStartFlowSettings(this.settings);
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
    const sfxRow = this.createSettingRow(
      '音效音量',
      `${Math.round(this.settings.sfxVolume * 100)}%`,
      () => {
        this.settings.sfxVolume = Math.max(0, this.settings.sfxVolume - 0.1);
        this.updateDisplay();
      },
      () => {
        this.settings.sfxVolume = Math.min(1, this.settings.sfxVolume + 0.1);
        this.updateDisplay();
      }
    );
    sfxRow.id = 'sfx-row';

    const musicRow = this.createSettingRow(
      '音乐音量',
      `${Math.round(this.settings.musicVolume * 100)}%`,
      () => {
        this.settings.musicVolume = Math.max(0, this.settings.musicVolume - 0.1);
        this.updateDisplay();
      },
      () => {
        this.settings.musicVolume = Math.min(1, this.settings.musicVolume + 0.1);
        this.updateDisplay();
      }
    );
    musicRow.id = 'music-row';

    const qualityRow = this.createSettingRow(
      '画质',
      this.getQualityPresetText(this.settings.qualityPreset),
      () => {
        const presetList: QualityPreset[] = ['auto', 'performance', 'balanced', 'quality'];
        const index = presetList.indexOf(this.settings.qualityPreset);
        const nextIndex = (index - 1 + presetList.length) % presetList.length;
        this.settings.qualityPreset = presetList[nextIndex];
        this.updateDisplay();
      },
      () => {
        const presetList: QualityPreset[] = ['auto', 'performance', 'balanced', 'quality'];
        const index = presetList.indexOf(this.settings.qualityPreset);
        const nextIndex = (index + 1) % presetList.length;
        this.settings.qualityPreset = presetList[nextIndex];
        this.updateDisplay();
      }
    );
    qualityRow.id = 'quality-row';

    const tutorialRow = this.createSettingRow(
      '试玩关卡',
      this.settings.tutorialEnabled ? '开启' : '关闭',
      () => {
        this.settings.tutorialEnabled = !this.settings.tutorialEnabled;
        this.updateDisplay();
      },
      () => {
        this.settings.tutorialEnabled = !this.settings.tutorialEnabled;
        this.updateDisplay();
      }
    );
    tutorialRow.id = 'tutorial-row';

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
    panel.appendChild(sfxRow);
    panel.appendChild(musicRow);
    panel.appendChild(qualityRow);
    panel.appendChild(tutorialRow);
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

    const testScoreValues: readonly number[] = TEST_SCORE_OPTIONS;
    const testScoreRow = this.createSettingRow(
      '测试分数',
      this.settings.testScore === 0 ? '关闭' : `${this.settings.testScore}`,
      () => {
        const currentIndex = Math.max(0, testScoreValues.indexOf(this.settings.testScore));
        this.settings.testScore = testScoreValues[Math.max(0, currentIndex - 1)];
        this.updateDisplay();
      },
      () => {
        const currentIndex = Math.max(0, testScoreValues.indexOf(this.settings.testScore));
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
    previewBtn.id = 'preview-btn';
    previewBtn.innerHTML = '✈️ 模型预览';
    previewBtn.onmouseenter = () => this.preloadModelPreviewModule();
    previewBtn.onfocus = () => this.preloadModelPreviewModule();
    previewBtn.onclick = async () => {
      if (previewBtn.disabled) {
        return;
      }

      const originalLabel = previewBtn.innerHTML;
      previewBtn.disabled = true;
      previewBtn.innerHTML = '⏳ 加载中...';

      try {
        const preview = await this.ensureModelPreview();
        this.container.style.display = 'none';
        preview.show();
      } catch (error) {
        console.error('Failed to load model preview', error);
      } finally {
        if (!this.isDisposed) {
          previewBtn.disabled = false;
          previewBtn.innerHTML = originalLabel;
        }
      }
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
    const texts = ['简单', '普通', '标准', '困难', '专家'];
    return texts[level - 1];
  }

  private getQualityPresetText(preset: QualityPreset): string {
    const labels: Record<QualityPreset, string> = {
      auto: '自动',
      performance: '性能',
      balanced: '平衡',
      quality: '高质量',
    };
    return labels[preset];
  }

  private updateDisplay(): void {
    const audioSettings = getAudioSettings(this.settings);
    const presentationSettings = getPresentationSettings(this.settings);

    const difficultyValue =
      document.getElementById('难度-value') ||
      document.querySelector('#difficulty-row .setting-value');
    const sfxValue =
      document.getElementById('音效音量-value') ||
      document.querySelector('#sfx-row .setting-value');
    const musicValue =
      document.getElementById('音乐音量-value') ||
      document.querySelector('#music-row .setting-value');
    const qualityValue =
      document.getElementById('画质-value') ||
      document.querySelector('#quality-row .setting-value');
    const tutorialValue =
      document.getElementById('教程-value') ||
      document.querySelector('#tutorial-row .setting-value');
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
    if (sfxValue) sfxValue.textContent = `${Math.round(audioSettings.sfxVolume * 100)}%`;
    if (musicValue) musicValue.textContent = `${Math.round(audioSettings.musicVolume * 100)}%`;
    if (qualityValue)
      qualityValue.textContent = this.getQualityPresetText(presentationSettings.qualityPreset);
    if (tutorialValue)
      tutorialValue.textContent = presentationSettings.tutorialEnabled ? '开启' : '关闭';
    if (livesValue) livesValue.textContent = `${this.settings.playerLives}`;
    if (levelValue) levelValue.textContent = `第${this.settings.startLevel}关`;
    if (modeValue)
      modeValue.textContent = this.settings.gameMode === 'normal' ? '普通模式' : 'Boss 模式';
    if (testScoreValue)
      testScoreValue.textContent =
        this.settings.testScore === 0 ? '关闭' : `${this.settings.testScore}`;
    if (startBtn)
      startBtn.textContent = this.settings.gameMode === 'normal' ? '🎮 开始游戏' : '👹 Boss 挑战';

    this.saveSettings();
  }

  private startGame(): void {
    this.container.style.display = 'none';
    this.onStart?.(this.settings);
  }

  public setOnStart(callback: (settings: GameSettings) => void): void {
    this.onStart = callback;
  }

  public reloadFromStorage(): void {
    this.loadSettings();
    this.updateDisplay();
  }

  public show(): void {
    this.reloadFromStorage();
    this.container.style.display = 'flex';
  }

  public hide(): void {
    this.container.style.display = 'none';
  }

  public dispose(): void {
    this.isDisposed = true;
    this.modelPreview?.dispose();
    this.container.remove();
  }
}

export interface GameSettings {
  difficulty: StartFlowSettings['difficulty'];
  sfxVolume: StartFlowSettings['sfxVolume'];
  musicVolume: StartFlowSettings['musicVolume'];
  qualityPreset: StartFlowSettings['qualityPreset'];
  tutorialEnabled: StartFlowSettings['tutorialEnabled'];
  playerLives: StartFlowSettings['playerLives'];
  startLevel: StartFlowSettings['startLevel'];
  gameMode: StartFlowSettings['gameMode'];
  testScore: StartFlowSettings['testScore'];
}
