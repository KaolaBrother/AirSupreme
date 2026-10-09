import { type QualityPreset } from '@/config';
import { unlockAudioFromUserGesture } from '@/core/Audio/AudioContextHost';
import {
  describeCheckpoint,
  loadCampaignCheckpoint,
  type CampaignSaveData,
} from '@/core/save/SaveSystem';
import {
  DEFAULT_START_FLOW_SETTINGS,
  LANGUAGE_ENDONYMS,
  getAudioSettings,
  getPresentationSettings,
  loadStartFlowSettings,
  saveStartFlowSettings,
  stepLanguage,
  TEST_SCORE_OPTIONS,
  type CameraModeSetting,
  type StartFlowSettings,
} from '@/core/SessionSettings';
import { TOTAL_LEVELS, getCampaignChapter } from '@/features/campaign/CampaignData';
import { getLocale, onLocaleChange, setLocale, tr, type LocalizedText } from '@/i18n';
import { HUD_COLORS, injectHudTokens } from '@/ui/theme/hudTokens';
import type { ModelPreview } from './ModelPreview';
type ModelPreviewModule = typeof import('./ModelPreview');

/** 难度档名（与 Difficulty.ts 五档的英文 / 中文名一致） */
const DIFFICULTY_LABELS: readonly LocalizedText[] = [
  { en: 'Very Easy', zh: '简单' },
  { en: 'Easy', zh: '普通' },
  { en: 'Normal', zh: '标准' },
  { en: 'Hard', zh: '困难' },
  { en: 'Expert', zh: '专家' },
];

const QUALITY_LABELS: Readonly<Record<QualityPreset, LocalizedText>> = {
  auto: { en: 'Auto', zh: '自动' },
  performance: { en: 'Performance', zh: '性能' },
  balanced: { en: 'Balanced', zh: '平衡' },
  quality: { en: 'High', zh: '高质量' },
};

const SWITCH_ON: LocalizedText = { en: 'On', zh: '开启' };
const SWITCH_OFF: LocalizedText = { en: 'Off', zh: '关闭' };

/** 操作说明：按键（字符串原样显示，双语对象按语言取）+ 动作 */
const CONTROL_LEGEND: ReadonlyArray<{
  keys: ReadonlyArray<string | LocalizedText>;
  joiner?: string;
  action: LocalizedText;
}> = [
  { keys: ['W', 'S'], action: { en: 'Pitch (nose up / down)', zh: '俯仰（机头上下）' } },
  { keys: ['A', 'D'], action: { en: 'Yaw (nose left / right)', zh: '偏航（机头左右）' } },
  { keys: ['Q', 'E'], action: { en: 'Roll (bank the wings)', zh: '翻滚（机翼倾斜）' } },
  { keys: [{ en: 'Space', zh: '空格' }], action: { en: 'Fire guns', zh: '开火' } },
  { keys: ['Shift'], action: { en: 'Boost', zh: '加速' } },
  { keys: ['M'], action: { en: 'Fire missile', zh: '发射导弹' } },
  { keys: ['F'], action: { en: 'Special weapon (hold)', zh: '特殊武器（可长按）' } },
  { keys: ['Tab', 'X'], action: { en: 'Cycle special weapon', zh: '切换特殊武器' } },
  { keys: ['1', '5'], joiner: ' – ', action: { en: 'Select special weapon', zh: '选择特殊武器' } },
  { keys: ['G'], action: { en: 'Drop flares', zh: '投放热焰弹' } },
  { keys: ['V'], action: { en: 'First / third-person view', zh: '切换第一 / 第三人称' } },
];

export class StartMenu {
  private container: HTMLDivElement;
  private settingsContainer: HTMLDivElement;
  private onStart?: (settings: GameSettings) => void;
  private onContinue?: (save: CampaignSaveData) => void;
  private continueButton: HTMLButtonElement | null = null;
  private modelPreview: ModelPreview | null = null;
  private modelPreviewPromise: Promise<ModelPreview> | null = null;
  private modelPreviewModulePromise: Promise<ModelPreviewModule> | null = null;
  private isDisposed: boolean = false;
  private unsubscribeLocale: (() => void) | null = null;

  private settings: GameSettings = { ...DEFAULT_START_FLOW_SETTINGS };

  constructor() {
    this.loadSettings();
    injectHudTokens();
    this.container = this.createContainer();
    this.settingsContainer = this.createSettingsPanel();
    this.container.appendChild(this.settingsContainer);
    document.body.appendChild(this.container);
    this.refreshContinueButton();
    this.scheduleModelPreviewPreload();
    this.unsubscribeLocale = onLocaleChange(() => this.applyLocale());
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
          throw new Error('StartMenu was disposed; model preview initialization cancelled');
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
          background: rgba(8, 14, 24, 1);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 20px;
          overflow-y: auto;
          z-index: 1000;
          font-family: var(--hud-font, 'Arial', sans-serif);
          color: var(--hud-text, ${HUD_COLORS.text});
        }

        .menu-title {
          font-size: 56px;
          font-weight: bold;
          letter-spacing: 0.14em;
          margin-bottom: 10px;
          color: var(--hud-sys, ${HUD_COLORS.sys});
          text-shadow: 0 0 20px rgba(143, 228, 255, 0.45);
        }

        .menu-subtitle {
          font-size: 24px;
          opacity: 0.8;
          margin-bottom: 40px;
          color: var(--hud-muted, ${HUD_COLORS.muted});
        }

        .settings-panel {
          background: var(--hud-glass, ${HUD_COLORS.glass});
          border-radius: var(--hud-radius, 12px);
          padding: 30px 40px;
          margin-bottom: 30px;
          backdrop-filter: blur(10px);
          border: 1px solid var(--hud-edge, ${HUD_COLORS.edge});
          width: min(420px, 100%);
          box-sizing: border-box;
          box-shadow: var(--hud-shadow, ${HUD_COLORS.shadow});
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

        /* 统一的数值宽度：各行的 - / + 按钮对齐（英文数值比中文长） */
        .setting-value {
          font-size: 20px;
          font-weight: bold;
          min-width: 6em;
          text-align: center;
          white-space: nowrap;
        }

        .start-btn,
        .preview-btn {
          padding: 16px 28px;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: 0.08em;
          border: 1px solid var(--hud-edge, ${HUD_COLORS.edge});
          border-radius: var(--hud-radius, 12px);
          background: var(--hud-glass, ${HUD_COLORS.glass});
          color: var(--hud-text, ${HUD_COLORS.text});
          cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-shadow: var(--hud-shadow, ${HUD_COLORS.shadow});
        }

        .start-btn:hover,
        .preview-btn:hover {
          border-color: var(--hud-sys, ${HUD_COLORS.sys});
          box-shadow: 0 0 16px rgba(143, 228, 255, 0.28);
        }

        .button-container {
          display: flex;
          gap: 20px;
          justify-content: center;
          margin-bottom: 30px;
          flex-wrap: wrap;
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
          gap: 12px;
          margin: 8px 0;
          font-size: 16px;
        }

        .control-row > span:first-child {
          flex-shrink: 0;
          white-space: nowrap;
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

        .continue-btn {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          width: 100%;
          box-sizing: border-box;
          margin: 0 0 18px;
          padding: 14px 18px;
          border: 1px solid var(--hud-sys, ${HUD_COLORS.sys});
          border-left: 3px solid var(--hud-ally, ${HUD_COLORS.ally});
          border-radius: var(--hud-radius, 12px);
          background: var(--hud-glass, ${HUD_COLORS.glass});
          color: var(--hud-text, ${HUD_COLORS.text});
          font-family: inherit;
          text-align: left;
          cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-shadow: var(--hud-shadow, ${HUD_COLORS.shadow});
        }

        .continue-btn:hover {
          box-shadow: 0 0 16px rgba(143, 228, 255, 0.28);
        }

        .continue-title {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: 0.08em;
        }

        .continue-detail {
          font-size: 15px;
          color: var(--hud-sys, ${HUD_COLORS.sys});
        }

        .continue-meta {
          font-size: 13px;
          color: var(--hud-muted, ${HUD_COLORS.muted});
        }

        .setting-label-group {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }

        .setting-caption {
          font-size: 12px;
          letter-spacing: 0.04em;
          color: var(--hud-muted, ${HUD_COLORS.muted});
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

        /* 手机竖屏：收窄留白、缩小字号，给较长的英文标签与数值留出空间 */
        @media (max-width: 480px) {
          #start-menu {
            padding: 28px 12px;
          }

          .menu-title {
            font-size: 40px;
          }

          .menu-subtitle {
            font-size: 18px;
            margin-bottom: 24px;
          }

          .settings-panel {
            padding: 20px 16px;
          }

          .setting-label {
            font-size: 16px;
          }

          .setting-control {
            gap: 8px;
          }

          .setting-value {
            font-size: 17px;
          }

          .start-btn,
          .preview-btn {
            padding: 14px 22px;
            font-size: 18px;
          }

          .controls-info {
            padding: 16px 16px;
          }

          .control-row {
            font-size: 14px;
          }
        }
      </style>

      <div class="menu-title">AIR SUPREME</div>
      <div class="menu-subtitle"></div>
    `;
    this.renderSubtitle(container);
    return container;
  }

  private renderSubtitle(container: HTMLElement = this.container): void {
    const subtitle = container.querySelector('.menu-subtitle');
    if (subtitle) {
      subtitle.textContent = tr({ en: '3D Air Combat', zh: '3D 空战游戏' });
    }
  }

  /**
   * 语言切换后重建设置面板（标签、数值、按钮、操作说明都按新语言渲染），
   * 并把键盘焦点放回原来那一行的同一个按钮。
   */
  private applyLocale(): void {
    if (this.isDisposed) {
      return;
    }
    // 语言也可能在暂停菜单里切换：内存中的设置跟上，避免之后把旧语言写回存储
    this.settings.language = getLocale();
    const active = document.activeElement;
    let focusRowId: string | null = null;
    let focusIndex = -1;
    if (active instanceof HTMLElement && this.settingsContainer.contains(active)) {
      const row = active.closest('.setting-row');
      if (row?.id) {
        focusRowId = row.id;
        focusIndex = Array.from(row.querySelectorAll('button')).indexOf(
          active as HTMLButtonElement
        );
      }
    }

    this.renderSubtitle();
    const panel = this.createSettingsPanel();
    this.settingsContainer.replaceWith(panel);
    this.settingsContainer = panel;
    this.refreshContinueButton();

    if (focusRowId && focusIndex >= 0) {
      const buttons = panel.querySelectorAll<HTMLButtonElement>(`#${focusRowId} button`);
      buttons[focusIndex]?.focus();
    }
  }

  private createSettingsPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'settings-panel';

    // 继续战役（存在有效检查点时显示）
    panel.appendChild(this.createContinueButton());

    // 界面语言：选项名用各语言自称；切换后整块面板按新语言重建（见 applyLocale）
    const changeLanguage = (direction: 1 | -1): void => {
      this.settings.language = stepLanguage(this.settings.language, direction);
      this.updateDisplay();
      setLocale(this.settings.language);
    };
    panel.appendChild(
      this.createSettingRow(
        'language',
        tr({ en: 'Language', zh: '语言' }),
        LANGUAGE_ENDONYMS[this.settings.language],
        () => changeLanguage(-1),
        () => changeLanguage(1)
      )
    );

    // 难度设置
    panel.appendChild(
      this.createSettingRow(
        'difficulty',
        tr({ en: 'Difficulty', zh: '难度' }),
        this.getDifficultyText(this.settings.difficulty),
        () => {
          this.settings.difficulty = Math.max(1, this.settings.difficulty - 1);
          this.updateDisplay();
        },
        () => {
          this.settings.difficulty = Math.min(5, this.settings.difficulty + 1);
          this.updateDisplay();
        }
      )
    );

    // 音量设置
    panel.appendChild(
      this.createSettingRow(
        'sfx',
        tr({ en: 'SFX volume', zh: '音效音量' }),
        `${Math.round(this.settings.sfxVolume * 100)}%`,
        () => {
          this.settings.sfxVolume = Math.max(0, this.settings.sfxVolume - 0.1);
          this.updateDisplay();
        },
        () => {
          this.settings.sfxVolume = Math.min(1, this.settings.sfxVolume + 0.1);
          this.updateDisplay();
        }
      )
    );

    panel.appendChild(
      this.createSettingRow(
        'music',
        tr({ en: 'Music volume', zh: '音乐音量' }),
        `${Math.round(this.settings.musicVolume * 100)}%`,
        () => {
          this.settings.musicVolume = Math.max(0, this.settings.musicVolume - 0.1);
          this.updateDisplay();
        },
        () => {
          this.settings.musicVolume = Math.min(1, this.settings.musicVolume + 0.1);
          this.updateDisplay();
        }
      )
    );

    // 角色配音音量（0% = 纯文字字幕）
    const stepVoice = (direction: 1 | -1): void => {
      const next = Math.round((this.settings.voiceVolume + direction * 0.1) * 10) / 10;
      this.settings.voiceVolume = Math.min(1, Math.max(0, next));
      this.updateDisplay();
    };
    panel.appendChild(
      this.createSettingRow(
        'voice',
        tr({ en: 'Voice volume', zh: '语音音量' }),
        `${Math.round(this.settings.voiceVolume * 100)}%`,
        () => stepVoice(-1),
        () => stepVoice(1)
      )
    );

    const presetList: QualityPreset[] = ['auto', 'performance', 'balanced', 'quality'];
    const stepQuality = (direction: 1 | -1): void => {
      const index = presetList.indexOf(this.settings.qualityPreset);
      const nextIndex = (index + direction + presetList.length) % presetList.length;
      this.settings.qualityPreset = presetList[nextIndex];
      this.updateDisplay();
    };
    panel.appendChild(
      this.createSettingRow(
        'quality',
        tr({ en: 'Graphics', zh: '画质' }),
        this.getQualityPresetText(this.settings.qualityPreset),
        () => stepQuality(-1),
        () => stepQuality(1)
      )
    );

    // 视角：第三人称（默认）/ 第一人称，对局中按 V 切换
    const toggleCameraMode = (): void => {
      this.settings.cameraMode =
        this.settings.cameraMode === 'first-person' ? 'third-person' : 'first-person';
      this.updateDisplay();
    };
    panel.appendChild(
      this.createSettingRow(
        'camera',
        tr({ en: 'Camera', zh: '视角' }),
        this.getCameraModeText(this.settings.cameraMode),
        toggleCameraMode,
        toggleCameraMode
      )
    );

    const toggleTutorial = (): void => {
      this.settings.tutorialEnabled = !this.settings.tutorialEnabled;
      this.updateDisplay();
    };
    panel.appendChild(
      this.createSettingRow(
        'tutorial',
        tr({ en: 'Tutorial', zh: '试玩关卡' }),
        tr(this.settings.tutorialEnabled ? SWITCH_ON : SWITCH_OFF),
        toggleTutorial,
        toggleTutorial
      )
    );

    // 生命值设置
    panel.appendChild(
      this.createSettingRow(
        'lives',
        tr({ en: 'Lives', zh: '生命数' }),
        `${this.settings.playerLives}`,
        () => {
          this.settings.playerLives = Math.max(1, this.settings.playerLives - 1);
          this.updateDisplay();
        },
        () => {
          this.settings.playerLives = Math.min(9, this.settings.playerLives + 1);
          this.updateDisplay();
        }
      )
    );

    // 选关设置（1..TOTAL_LEVELS，下方显示章节标题）
    const levelRow = this.createSettingRow(
      'level',
      tr({ en: 'Start level', zh: '起始关卡' }),
      this.getLevelText(this.settings.startLevel),
      () => {
        this.settings.startLevel = Math.max(1, this.settings.startLevel - 1);
        this.updateDisplay();
      },
      () => {
        this.settings.startLevel = Math.min(TOTAL_LEVELS, this.settings.startLevel + 1);
        this.updateDisplay();
      },
      this.getChapterCaption(this.settings.startLevel)
    );
    const levelCaption = levelRow.querySelector('.setting-caption');
    if (levelCaption) {
      levelCaption.id = 'level-chapter';
    }
    panel.appendChild(levelRow);

    // 游戏模式选择
    const toggleMode = (): void => {
      this.settings.gameMode = this.settings.gameMode === 'normal' ? 'boss' : 'normal';
      this.updateDisplay();
    };
    panel.appendChild(
      this.createSettingRow(
        'mode',
        tr({ en: 'Game mode', zh: '游戏模式' }),
        this.getModeText(),
        toggleMode,
        toggleMode
      )
    );

    const testScoreValues: readonly number[] = TEST_SCORE_OPTIONS;
    panel.appendChild(
      this.createSettingRow(
        'testscore',
        tr({ en: 'Test score', zh: '测试分数' }),
        this.getTestScoreText(),
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
      )
    );

    // 按钮容器 - 并排放置
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';

    // 开始按钮
    const startBtn = document.createElement('button');
    startBtn.className = 'start-btn';
    startBtn.textContent = this.getStartButtonText();
    startBtn.id = 'start-btn';
    startBtn.onclick = () => this.startGame();
    buttonContainer.appendChild(startBtn);

    // 模型预览按钮
    const previewLabel: LocalizedText = { en: 'Model Preview', zh: '模型预览' };
    const previewBtn = document.createElement('button');
    previewBtn.className = 'preview-btn';
    previewBtn.id = 'preview-btn';
    previewBtn.textContent = tr(previewLabel);
    previewBtn.onmouseenter = () => this.preloadModelPreviewModule();
    previewBtn.onfocus = () => this.preloadModelPreviewModule();
    previewBtn.onclick = async () => {
      if (previewBtn.disabled) {
        return;
      }

      previewBtn.disabled = true;
      previewBtn.textContent = tr({ en: 'Loading…', zh: '加载中...' });

      try {
        const preview = await this.ensureModelPreview();
        this.container.style.display = 'none';
        preview.show();
      } catch (error) {
        console.error('Failed to load model preview', error);
      } finally {
        if (!this.isDisposed) {
          previewBtn.disabled = false;
          previewBtn.textContent = tr(previewLabel);
        }
      }
    };
    buttonContainer.appendChild(previewBtn);

    panel.appendChild(buttonContainer);
    panel.appendChild(this.createControlsLegend());

    return panel;
  }

  /** 控制说明：按键 + 动作；文字都走 textContent */
  private createControlsLegend(): HTMLDivElement {
    const controlsInfo = document.createElement('div');
    controlsInfo.className = 'controls-info';

    const title = document.createElement('div');
    title.className = 'controls-title';
    title.textContent = tr({ en: '📖 Controls', zh: '📖 控制说明' });
    const blocks: HTMLElement[] = [title];

    for (const entry of CONTROL_LEGEND) {
      const row = document.createElement('div');
      row.className = 'control-row';
      const keys = document.createElement('span');
      entry.keys.forEach((key, index) => {
        if (index > 0) {
          keys.append(entry.joiner ?? ' / ');
        }
        const keyEl = document.createElement('span');
        keyEl.className = 'key';
        keyEl.textContent = tr(key);
        keys.appendChild(keyEl);
      });
      const action = document.createElement('span');
      action.textContent = tr(entry.action);
      // 空白文本节点不参与 flex 排版，只让 textContent / 读屏里按键与说明分成两个词
      row.append(keys, ' ', action);
      blocks.push(row);
    }

    const mobile = document.createElement('div');
    mobile.className = 'mobile-controls-info';
    mobile.textContent = tr({
      en: '📱 Mobile: virtual stick and on-screen buttons',
      zh: '📱 移动端：使用虚拟摇杆和按钮控制',
    });
    blocks.push(mobile);
    blocks.forEach((block) => controlsInfo.append(block, '\n'));
    return controlsInfo;
  }

  private createContinueButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'continue-btn';
    button.className = 'continue-btn';
    button.style.display = 'none';

    const title = document.createElement('span');
    title.className = 'continue-title';
    title.textContent = tr({ en: 'Continue Campaign', zh: '继续战役' });

    const detail = document.createElement('span');
    detail.className = 'continue-detail';
    detail.id = 'continue-detail';

    const meta = document.createElement('span');
    meta.className = 'continue-meta';
    meta.id = 'continue-meta';

    // 按钮是 flex 纵列，空白节点不影响排版，只让无障碍名称里三段文字之间有空格
    button.append(title, ' ', detail, ' ', meta);
    button.onclick = () => this.continueCampaign();

    this.continueButton = button;
    return button;
  }

  /** 按当前存档刷新“继续战役”按钮；损坏的存档会在读取时被清理 */
  private refreshContinueButton(): void {
    const button = this.continueButton;
    if (!button) {
      return;
    }

    const save = loadCampaignCheckpoint();
    if (!save) {
      button.style.display = 'none';
      return;
    }

    const detail = button.querySelector('.continue-detail');
    const meta = button.querySelector('.continue-meta');
    if (detail) {
      detail.textContent = describeCheckpoint(save);
    }
    if (meta) {
      meta.textContent = tr(
        {
          en: 'Score {score} · {difficulty} · Lives {lives}',
          zh: '得分 {score} · {difficulty} · 生命 {lives}',
        },
        {
          score: save.score,
          difficulty: this.getDifficultyText(save.difficulty),
          lives: save.lives,
        }
      );
    }
    button.style.display = '';
  }

  private continueCampaign(): void {
    const save = loadCampaignCheckpoint();
    if (!save) {
      this.refreshContinueButton();
      return;
    }
    if (!this.onContinue) {
      return;
    }

    unlockAudioFromUserGesture();
    this.container.style.display = 'none';
    this.onContinue(save);
  }

  /** key 决定行 / 数值的 id（#key-row / #key-value），与界面语言无关 */
  private createSettingRow(
    key: string,
    label: string,
    initialValue: string,
    onDecrease: () => void,
    onIncrease: () => void,
    caption?: string
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'setting-row';
    row.id = `${key}-row`;

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
    valueEl.id = `${key}-value`;

    const increaseBtn = document.createElement('button');
    increaseBtn.className = 'setting-btn';
    increaseBtn.textContent = '+';
    increaseBtn.onclick = onIncrease;

    control.appendChild(decreaseBtn);
    control.appendChild(valueEl);
    control.appendChild(increaseBtn);

    if (caption === undefined) {
      row.appendChild(labelEl);
    } else {
      const labelGroup = document.createElement('div');
      labelGroup.className = 'setting-label-group';
      const captionEl = document.createElement('span');
      captionEl.className = 'setting-caption';
      captionEl.textContent = caption;
      labelGroup.appendChild(labelEl);
      labelGroup.appendChild(captionEl);
      row.appendChild(labelGroup);
    }
    row.appendChild(control);

    return row;
  }

  private getDifficultyText(level: number): string {
    return tr(DIFFICULTY_LABELS[level - 1] ?? DIFFICULTY_LABELS[2]);
  }

  /** 如“第六章 · 熔炉之心” */
  private getChapterCaption(level: number): string {
    const chapter = getCampaignChapter(level);
    return `${tr(chapter.chapterLabel)} · ${tr(chapter.title)}`;
  }

  private getLevelText(level: number): string {
    return tr({ en: 'Level {level}', zh: '第{level}关' }, { level });
  }

  private getCameraModeText(mode: CameraModeSetting): string {
    return mode === 'first-person'
      ? tr({ en: 'First-person', zh: '第一人称' })
      : tr({ en: 'Third-person', zh: '第三人称' });
  }

  private getQualityPresetText(preset: QualityPreset): string {
    return tr(QUALITY_LABELS[preset] ?? QUALITY_LABELS.auto);
  }

  private getModeText(): string {
    return this.settings.gameMode === 'normal'
      ? tr({ en: 'Normal', zh: '普通模式' })
      : tr({ en: 'Boss mode', zh: 'Boss 模式' });
  }

  private getTestScoreText(): string {
    return this.settings.testScore === 0 ? tr(SWITCH_OFF) : `${this.settings.testScore}`;
  }

  private getStartButtonText(): string {
    return this.settings.gameMode === 'normal'
      ? tr({ en: 'Start Game', zh: '开始游戏' })
      : tr({ en: 'Boss Challenge', zh: 'Boss 挑战' });
  }

  private setRowValue(key: string, text: string): void {
    const value = this.container.querySelector(`#${key}-row .setting-value`);
    if (value) {
      value.textContent = text;
    }
  }

  private updateDisplay(): void {
    const audioSettings = getAudioSettings(this.settings);
    const presentationSettings = getPresentationSettings(this.settings);

    this.setRowValue('language', LANGUAGE_ENDONYMS[this.settings.language]);
    this.setRowValue('difficulty', this.getDifficultyText(this.settings.difficulty));
    this.setRowValue('sfx', `${Math.round(audioSettings.sfxVolume * 100)}%`);
    this.setRowValue('music', `${Math.round(audioSettings.musicVolume * 100)}%`);
    this.setRowValue('voice', `${Math.round(this.settings.voiceVolume * 100)}%`);
    this.setRowValue('quality', this.getQualityPresetText(presentationSettings.qualityPreset));
    this.setRowValue('camera', this.getCameraModeText(this.settings.cameraMode));
    this.setRowValue('tutorial', tr(presentationSettings.tutorialEnabled ? SWITCH_ON : SWITCH_OFF));
    this.setRowValue('lives', `${this.settings.playerLives}`);
    this.setRowValue('level', this.getLevelText(this.settings.startLevel));
    this.setRowValue('mode', this.getModeText());
    this.setRowValue('testscore', this.getTestScoreText());

    const levelCaption = this.container.querySelector('#level-chapter');
    if (levelCaption) {
      levelCaption.textContent = this.getChapterCaption(this.settings.startLevel);
    }
    const startBtn = this.container.querySelector('#start-btn');
    if (startBtn) {
      startBtn.textContent = this.getStartButtonText();
    }

    this.saveSettings();
  }

  private startGame(): void {
    unlockAudioFromUserGesture();
    this.container.style.display = 'none';
    this.onStart?.(this.settings);
  }

  public setOnStart(callback: (settings: GameSettings) => void): void {
    this.onStart = callback;
  }

  /** 点击“继续战役”时回调（传入刚读取并校验过的检查点）；菜单会先隐藏 */
  public setOnContinue(callback: (save: CampaignSaveData) => void): void {
    this.onContinue = callback;
  }

  public reloadFromStorage(): void {
    this.loadSettings();
    this.updateDisplay();
    this.refreshContinueButton();
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
    this.unsubscribeLocale?.();
    this.unsubscribeLocale = null;
    this.modelPreview?.dispose();
    this.container.remove();
  }
}

export interface GameSettings {
  difficulty: StartFlowSettings['difficulty'];
  sfxVolume: StartFlowSettings['sfxVolume'];
  musicVolume: StartFlowSettings['musicVolume'];
  voiceVolume: StartFlowSettings['voiceVolume'];
  qualityPreset: StartFlowSettings['qualityPreset'];
  tutorialEnabled: StartFlowSettings['tutorialEnabled'];
  playerLives: StartFlowSettings['playerLives'];
  startLevel: StartFlowSettings['startLevel'];
  gameMode: StartFlowSettings['gameMode'];
  testScore: StartFlowSettings['testScore'];
  cameraMode: StartFlowSettings['cameraMode'];
  language: StartFlowSettings['language'];
}
