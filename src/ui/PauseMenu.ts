import type { QualityPreset } from '@/config';
import {
  DEFAULT_START_FLOW_SETTINGS,
  LANGUAGE_ENDONYMS,
  stepLanguage,
  type StartFlowSettings,
} from '@/core/SessionSettings';
import { onLocaleChange, setLocale, tr, type LocalizedText } from '@/i18n';
import { HUD_COLORS, injectHudTokens } from '@/ui/theme/hudTokens';

export interface IPauseMenuOptions {
  onContinue: () => void;
  onUpgrade: () => void;
  onExitToMenu: () => void;
  applyAudio: (sfx: number, music: number) => void;
  /** 角色配音音量 0..1（立即生效）；缺省不显示语音一行 */
  applyVoice?: (voice: number) => void;
  applyQuality: (preset: QualityPreset) => void;
  loadSettings: () => StartFlowSettings;
  saveSettings: (partial: Partial<StartFlowSettings>) => void;
}

const QUALITY_PRESETS: QualityPreset[] = ['auto', 'performance', 'balanced', 'quality'];
const QUALITY_LABELS: Record<QualityPreset, LocalizedText> = {
  auto: { en: 'Auto', zh: '自动' },
  performance: { en: 'Performance', zh: '性能' },
  balanced: { en: 'Balanced', zh: '平衡' },
  quality: { en: 'High', zh: '高质量' },
};
const EXIT_CONFIRM_COPY: LocalizedText = {
  en: 'Return to the main menu? Your current progress will be lost.',
  zh: '返回主菜单？当前进度将丢失。',
};
const VOLUME_STEP = 0.1;

type VolumeBus = 'sfx' | 'music' | 'voice';

const VOLUME_LABELS: Readonly<Record<VolumeBus, LocalizedText>> = {
  sfx: { en: 'Sound effects', zh: '音效' },
  music: { en: 'Music', zh: '音乐' },
  voice: { en: 'Voice', zh: '语音' },
};

enum PauseMenuView {
  Default = 'default',
  Settings = 'settings',
  Confirm = 'confirm',
}

/**
 * 暂停菜单：继续 / 升级 / 运行时音画与语言设置 / 返回主菜单确认
 */
export class PauseMenu {
  private readonly options: IPauseMenuOptions;
  private readonly overlay: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private visible = false;
  private view: PauseMenuView = PauseMenuView.Default;
  private settings: StartFlowSettings = { ...DEFAULT_START_FLOW_SETTINGS };
  private readonly unsubscribeLocale: () => void;

  constructor(options: IPauseMenuOptions) {
    this.options = options;
    injectHudTokens();
    this.overlay = document.createElement('div');
    this.overlay.id = 'pause-menu';
    this.overlay.className = 'hud-glass';
    this.overlay.setAttribute('aria-hidden', 'true');
    this.overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 200;
      display: none;
      align-items: center;
      justify-content: center;
      background: var(--hud-glass, ${HUD_COLORS.glass});
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      font-family: var(--hud-font, 'Arial', sans-serif);
      color: var(--hud-text, ${HUD_COLORS.text});
      box-sizing: border-box;
      padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    `;

    const style = document.createElement('style');
    style.textContent = `
      #pause-menu {
        z-index: 200;
        padding: env(safe-area-inset-top) env(safe-area-inset-right)
          env(safe-area-inset-bottom) env(safe-area-inset-left);
      }

      #pause-menu .pause-panel {
        width: min(360px, calc(100% - 32px));
        max-width: 360px;
        box-sizing: border-box;
      }

      #pause-menu button {
        min-height: 48px;
        pointer-events: auto;
      }

      @media (max-width: 480px) {
        #pause-menu .pause-actions {
          flex-direction: column;
        }
      }
    `;

    this.panel = document.createElement('div');
    this.panel.className = 'pause-panel';
    this.panel.style.cssText = `
      width: min(360px, calc(100% - 32px));
      max-width: 360px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 24px 20px;
      border-radius: var(--hud-radius, 12px);
      background: var(--hud-glass, ${HUD_COLORS.glass});
      border: 1px solid var(--hud-edge, ${HUD_COLORS.edge});
      box-shadow: var(--hud-shadow, ${HUD_COLORS.shadow});
    `;

    this.overlay.appendChild(style);
    this.overlay.appendChild(this.panel);
    document.body.appendChild(this.overlay);
    this.renderDefaultView();
    // 语言切换后按新语言重绘当前视图（停留在原来的页面）
    this.unsubscribeLocale = onLocaleChange(() => this.renderView(this.view));
  }

  public show(): void {
    this.settings = { ...this.options.loadSettings() };
    this.visible = true;
    this.overlay.style.display = 'flex';
    this.overlay.setAttribute('aria-hidden', 'false');
    this.renderDefaultView();
  }

  public hide(): void {
    this.visible = false;
    this.overlay.style.display = 'none';
    this.overlay.setAttribute('aria-hidden', 'true');
  }

  public isVisible(): boolean {
    return this.visible;
  }

  /**
   * ESC 处理：确认/设置页返回默认视图并消费按键；默认视图交由协调器继续游戏。
   */
  public handleEscape(): boolean {
    if (!this.visible) {
      return false;
    }

    if (this.view === PauseMenuView.Confirm || this.view === PauseMenuView.Settings) {
      this.renderDefaultView();
      return true;
    }

    return false;
  }

  public dispose(): void {
    this.visible = false;
    this.unsubscribeLocale();
    this.overlay.remove();
  }

  private renderView(view: PauseMenuView): void {
    if (view === PauseMenuView.Settings) {
      this.renderSettingsView();
    } else if (view === PauseMenuView.Confirm) {
      this.renderConfirmView();
    } else {
      this.renderDefaultView();
    }
  }

  private renderDefaultView(): void {
    this.view = PauseMenuView.Default;
    this.panel.replaceChildren();
    this.panel.appendChild(this.createTitle(tr({ en: 'Paused', zh: '暂停' })));

    const actions = document.createElement('div');
    actions.className = 'pause-actions';
    actions.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
    `;
    actions.appendChild(
      this.createActionButton(tr({ en: 'Resume', zh: '继续' }), () => this.options.onContinue())
    );
    actions.appendChild(
      this.createActionButton(tr({ en: 'Upgrades', zh: '升级' }), () => this.options.onUpgrade())
    );
    actions.appendChild(
      this.createActionButton(tr({ en: 'Settings', zh: '设置' }), () => this.renderSettingsView())
    );
    actions.appendChild(
      this.createActionButton(tr({ en: 'Main Menu', zh: '返回菜单' }), () =>
        this.renderConfirmView()
      )
    );
    this.panel.appendChild(actions);
  }

  private renderSettingsView(): void {
    this.view = PauseMenuView.Settings;
    this.panel.replaceChildren();
    this.panel.appendChild(this.createTitle(tr({ en: 'Settings', zh: '设置' })));
    this.panel.appendChild(this.createVolumeRow('sfx'));
    this.panel.appendChild(this.createVolumeRow('music'));
    if (this.options.applyVoice) {
      this.panel.appendChild(this.createVolumeRow('voice'));
    }
    this.panel.appendChild(this.createQualityRow());
    this.panel.appendChild(this.createLanguageRow());
    this.panel.appendChild(
      this.createActionButton(tr({ en: 'Back', zh: '返回' }), () => this.renderDefaultView())
    );
  }

  private renderConfirmView(): void {
    this.view = PauseMenuView.Confirm;
    this.panel.replaceChildren();
    this.panel.appendChild(this.createTitle(tr({ en: 'Leave Mission', zh: '离开' })));

    const message = document.createElement('div');
    message.textContent = tr(EXIT_CONFIRM_COPY);
    message.style.cssText = `
      font-size: 16px;
      line-height: 1.5;
      text-align: center;
      color: var(--hud-text, ${HUD_COLORS.text});
    `;
    this.panel.appendChild(message);

    const actions = document.createElement('div');
    actions.className = 'pause-actions';
    actions.style.cssText = `
      display: flex;
      flex-direction: row;
      gap: 12px;
      width: 100%;
    `;
    actions.appendChild(
      this.createActionButton(tr({ en: 'Cancel', zh: '取消' }), () => this.renderDefaultView())
    );
    actions.appendChild(
      this.createActionButton(tr({ en: 'Confirm', zh: '确定' }), () => this.options.onExitToMenu())
    );
    this.panel.appendChild(actions);
  }

  private createVolumeRow(bus: VolumeBus): HTMLDivElement {
    const valueEl = document.createElement('span');
    valueEl.textContent = this.formatVolume(this.getVolume(bus));
    valueEl.style.cssText =
      'min-width: 5em; text-align: center; font-variant-numeric: tabular-nums;';

    const row = this.createStepperRow(
      tr(VOLUME_LABELS[bus]),
      valueEl,
      () => this.adjustVolume(bus, -1, valueEl),
      () => this.adjustVolume(bus, 1, valueEl)
    );
    row.setAttribute('data-setting', bus);
    return row;
  }

  private getVolume(bus: VolumeBus): number {
    if (bus === 'sfx') return this.settings.sfxVolume;
    if (bus === 'music') return this.settings.musicVolume;
    return this.settings.voiceVolume;
  }

  private createQualityRow(): HTMLDivElement {
    const valueEl = document.createElement('span');
    valueEl.textContent = this.getQualityLabel(this.settings.qualityPreset);
    valueEl.style.cssText = 'min-width: 5em; text-align: center; white-space: nowrap;';

    return this.createStepperRow(
      tr({ en: 'Graphics', zh: '画质' }),
      valueEl,
      () => this.adjustQuality(-1, valueEl),
      () => this.adjustQuality(1, valueEl)
    );
  }

  /** 语言：选项名用各语言自称；切换立即生效并持久化，界面随 onLocaleChange 重绘 */
  private createLanguageRow(): HTMLDivElement {
    const valueEl = document.createElement('span');
    valueEl.textContent = LANGUAGE_ENDONYMS[this.settings.language];
    valueEl.style.cssText = 'min-width: 5em; text-align: center; white-space: nowrap;';

    const row = this.createStepperRow(
      tr({ en: 'Language', zh: '语言' }),
      valueEl,
      () => this.changeLanguage(-1, valueEl),
      () => this.changeLanguage(1, valueEl)
    );
    row.setAttribute('data-setting', 'language');
    return row;
  }

  /** 标签 + [-] 数值 [+] 的一行 */
  private createStepperRow(
    label: string,
    valueEl: HTMLElement,
    onDecrease: () => void,
    onIncrease: () => void
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
    `;

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    labelEl.style.cssText =
      'min-width: 0; font-size: 16px; font-weight: 700; letter-spacing: 0.06em; line-height: 1.25;';

    const control = document.createElement('div');
    control.style.cssText = 'flex: none; display: flex; align-items: center; gap: 8px;';

    const minus = this.createActionButton('-', onDecrease);
    const plus = this.createActionButton('+', onIncrease);
    control.appendChild(minus);
    control.appendChild(valueEl);
    control.appendChild(plus);

    row.appendChild(labelEl);
    row.appendChild(control);
    return row;
  }

  private createTitle(text: string): HTMLDivElement {
    const title = document.createElement('div');
    title.textContent = text;
    title.style.cssText = `
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-align: center;
      margin-bottom: 8px;
    `;
    return title;
  }

  private createActionButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.cssText = `
      min-height: 48px;
      pointer-events: auto;
      cursor: pointer;
      flex: 1;
      border: 1px solid var(--hud-edge, ${HUD_COLORS.edge});
      border-radius: var(--hud-radius, 12px);
      padding: 12px 16px;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--hud-text, ${HUD_COLORS.text});
      background: var(--hud-glass, ${HUD_COLORS.glass});
      box-shadow: var(--hud-shadow, ${HUD_COLORS.shadow});
    `;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  private adjustVolume(bus: VolumeBus, direction: 1 | -1, valueEl: HTMLElement): void {
    const next = this.clampVolume(this.getVolume(bus) + direction * VOLUME_STEP);
    if (bus === 'sfx') {
      this.settings.sfxVolume = next;
      this.options.applyAudio(next, this.settings.musicVolume);
      this.options.saveSettings({ sfxVolume: next });
    } else if (bus === 'music') {
      this.settings.musicVolume = next;
      this.options.applyAudio(this.settings.sfxVolume, next);
      this.options.saveSettings({ musicVolume: next });
    } else {
      this.settings.voiceVolume = next;
      this.options.applyVoice?.(next);
      this.options.saveSettings({ voiceVolume: next });
    }
    valueEl.textContent = this.formatVolume(next);
  }

  private adjustQuality(direction: 1 | -1, valueEl: HTMLElement): void {
    const next = this.stepQuality(this.settings.qualityPreset, direction);
    this.settings.qualityPreset = next;
    this.options.applyQuality(next);
    this.options.saveSettings({ qualityPreset: next });
    valueEl.textContent = this.getQualityLabel(next);
  }

  private changeLanguage(direction: 1 | -1, valueEl: HTMLElement): void {
    const next = stepLanguage(this.settings.language, direction);
    this.settings.language = next;
    this.options.saveSettings({ language: next });
    valueEl.textContent = LANGUAGE_ENDONYMS[next];
    // 会触发 onLocaleChange：本菜单、HUD、触控按键等按新语言重绘
    setLocale(next);
  }

  private stepQuality(current: QualityPreset, direction: 1 | -1): QualityPreset {
    const index = QUALITY_PRESETS.indexOf(current);
    const from = index >= 0 ? index : 0;
    const nextIndex = (from + direction + QUALITY_PRESETS.length) % QUALITY_PRESETS.length;
    return QUALITY_PRESETS[nextIndex];
  }

  private clampVolume(value: number): number {
    const rounded = Math.round(value * 10) / 10;
    return Math.min(1, Math.max(0, rounded));
  }

  private formatVolume(value: number): string {
    return `${Math.round(this.clampVolume(value) * 100)}%`;
  }

  private getQualityLabel(preset: QualityPreset): string {
    return tr(QUALITY_LABELS[preset] ?? QUALITY_LABELS.auto);
  }
}
