import type { QualityPreset } from '@/config';
import {
  DEFAULT_START_FLOW_SETTINGS,
  type StartFlowSettings,
} from '@/core/SessionSettings';
import { HUD_COLORS, injectHudTokens } from '@/ui/theme/hudTokens';

export interface IPauseMenuOptions {
  onContinue: () => void;
  onUpgrade: () => void;
  onExitToMenu: () => void;
  applyAudio: (sfx: number, music: number) => void;
  applyQuality: (preset: QualityPreset) => void;
  loadSettings: () => StartFlowSettings;
  saveSettings: (partial: Partial<StartFlowSettings>) => void;
}

const QUALITY_PRESETS: QualityPreset[] = ['auto', 'performance', 'balanced', 'quality'];
const QUALITY_LABELS: Record<QualityPreset, string> = {
  auto: '自动',
  performance: '性能',
  balanced: '平衡',
  quality: '高质量',
};
const EXIT_CONFIRM_COPY = '返回主菜单？当前进度将丢失。';
const VOLUME_STEP = 0.1;

enum PauseMenuView {
  Default = 'default',
  Settings = 'settings',
  Confirm = 'confirm',
}

/**
 * 暂停菜单：继续 / 升级 / 运行时音画设置 / 返回主菜单确认
 */
export class PauseMenu {
  private readonly options: IPauseMenuOptions;
  private readonly overlay: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private visible = false;
  private view: PauseMenuView = PauseMenuView.Default;
  private settings: StartFlowSettings = { ...DEFAULT_START_FLOW_SETTINGS };

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
    this.overlay.remove();
  }

  private renderDefaultView(): void {
    this.view = PauseMenuView.Default;
    this.panel.replaceChildren();
    this.panel.appendChild(this.createTitle('暂停'));

    const actions = document.createElement('div');
    actions.className = 'pause-actions';
    actions.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
    `;
    actions.appendChild(this.createActionButton('继续', () => this.options.onContinue()));
    actions.appendChild(this.createActionButton('升级', () => this.options.onUpgrade()));
    actions.appendChild(this.createActionButton('设置', () => this.renderSettingsView()));
    actions.appendChild(this.createActionButton('返回菜单', () => this.renderConfirmView()));
    this.panel.appendChild(actions);
  }

  private renderSettingsView(): void {
    this.view = PauseMenuView.Settings;
    this.panel.replaceChildren();
    this.panel.appendChild(this.createTitle('设置'));
    this.panel.appendChild(this.createVolumeRow('音效', 'sfx'));
    this.panel.appendChild(this.createVolumeRow('音乐', 'music'));
    this.panel.appendChild(this.createQualityRow());
    this.panel.appendChild(this.createActionButton('返回', () => this.renderDefaultView()));
  }

  private renderConfirmView(): void {
    this.view = PauseMenuView.Confirm;
    this.panel.replaceChildren();
    this.panel.appendChild(this.createTitle('离开'));

    const message = document.createElement('div');
    message.textContent = EXIT_CONFIRM_COPY;
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
    actions.appendChild(this.createActionButton('取消', () => this.renderDefaultView()));
    actions.appendChild(this.createActionButton('确定', () => this.options.onExitToMenu()));
    this.panel.appendChild(actions);
  }

  private createVolumeRow(label: '音效' | '音乐', bus: 'sfx' | 'music'): HTMLDivElement {
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
    labelEl.style.cssText = 'font-size: 16px; font-weight: 700; letter-spacing: 0.06em;';

    const control = document.createElement('div');
    control.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const valueEl = document.createElement('span');
    valueEl.textContent = this.formatVolume(
      bus === 'sfx' ? this.settings.sfxVolume : this.settings.musicVolume
    );
    valueEl.style.cssText = 'min-width: 48px; text-align: center; font-variant-numeric: tabular-nums;';

    const minus = this.createActionButton('-', () => this.adjustVolume(bus, -1, valueEl));
    const plus = this.createActionButton('+', () => this.adjustVolume(bus, 1, valueEl));
    control.appendChild(minus);
    control.appendChild(valueEl);
    control.appendChild(plus);

    row.appendChild(labelEl);
    row.appendChild(control);
    return row;
  }

  private createQualityRow(): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
    `;

    const labelEl = document.createElement('span');
    labelEl.textContent = '画质';
    labelEl.style.cssText = 'font-size: 16px; font-weight: 700; letter-spacing: 0.06em;';

    const control = document.createElement('div');
    control.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const valueEl = document.createElement('span');
    valueEl.textContent = this.getQualityLabel(this.settings.qualityPreset);
    valueEl.style.cssText = 'min-width: 64px; text-align: center;';

    const minus = this.createActionButton('-', () => this.adjustQuality(-1, valueEl));
    const plus = this.createActionButton('+', () => this.adjustQuality(1, valueEl));
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

  private adjustVolume(
    bus: 'sfx' | 'music',
    direction: 1 | -1,
    valueEl: HTMLElement
  ): void {
    const current = bus === 'sfx' ? this.settings.sfxVolume : this.settings.musicVolume;
    const next = this.clampVolume(current + direction * VOLUME_STEP);
    if (bus === 'sfx') {
      this.settings.sfxVolume = next;
      this.options.applyAudio(next, this.settings.musicVolume);
      this.options.saveSettings({ sfxVolume: next });
    } else {
      this.settings.musicVolume = next;
      this.options.applyAudio(this.settings.sfxVolume, next);
      this.options.saveSettings({ musicVolume: next });
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
    return QUALITY_LABELS[preset] ?? QUALITY_LABELS.auto;
  }
}
