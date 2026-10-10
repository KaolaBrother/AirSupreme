import type { QualityPreset } from '@/config';
import type { CampaignExitSave } from '@/core/campaign/CampaignFlowController';
import {
  describeCheckpoint,
  loadCampaignCheckpoint,
  type CheckpointKind,
} from '@/core/save/SaveSystem';
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
  /** 回到主菜单（菜单在存档成功、无需存档或玩家选择“仍然退出”之后调用） */
  onExitToMenu: () => void;
  /**
   * “保存并退出”的预告（只读，不写存档）：会存到哪里，或者本局为什么不存。
   * 与 onSaveAndExit 成对提供才启用；缺一个时菜单自己不存档，按钮仍叫“返回菜单”，
   * 确认页只读已有检查点、如实说明“继续战役”会从哪里开始。
   */
  getSaveStatus?: () => CampaignExitSave;
  /**
   * 执行存档并返回真实结果。'failed' 时菜单停在失败页，由玩家选择仍然退出或返回；
   * 其余结果随即调用 onExitToMenu（预告说会存、结果却没存时回到确认页重新说明，不退出）。
   */
  onSaveAndExit?: () => CampaignExitSave;
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
const SAVE_AND_EXIT_LABEL: LocalizedText = { en: 'Save & Exit', zh: '保存并退出' };
const MAIN_MENU_LABEL: LocalizedText = { en: 'Main Menu', zh: '返回菜单' };
const EXIT_LABEL: LocalizedText = { en: 'Exit', zh: '退出' };

/**
 * 退出确认文案：只陈述真实会发生的事。{position} 是 describeCheckpoint 的检查点描述，
 * 如 “Ch. 1 · First Sortie · Wave 2”。
 */
const SAVES_AT_COPY: LocalizedText = { en: 'Saves at {position}.', zh: '存档位置：{position}。' };
const WAVE_CONTINUE_COPY: LocalizedText = {
  en: 'Continue Campaign starts that wave from the beginning, with your score, lives and upgrades.',
  zh: '“继续战役”将从该波次的开头重新开始，保留分数、生命和升级。',
};
const CONTINUE_COPY: Readonly<Record<CheckpointKind, LocalizedText>> = {
  'level-start': WAVE_CONTINUE_COPY,
  wave: WAVE_CONTINUE_COPY,
  boss: {
    en:
      'Continue Campaign starts the boss fight from the beginning, ' +
      'with your score, lives and upgrades.',
    zh: '“继续战役”将从 Boss 战的开头重新开始，保留分数、生命和升级。',
  },
  hangar: {
    en: 'Continue Campaign returns to the hangar with your score, lives and upgrades.',
    zh: '“继续战役”将回到机库整备，保留分数、生命和升级。',
  },
};
const NO_SAVE_MODE_COPY: LocalizedText = {
  en: 'This mode does not save progress. Exit to the main menu?',
  zh: '此模式不保存进度。返回主菜单？',
};
const NOT_STARTED_COPY: LocalizedText = {
  en: 'Nothing to save yet: the mission has not started. Exit to the main menu?',
  zh: '任务尚未开始，暂无可保存的进度。返回主菜单？',
};
const CAMPAIGN_COMPLETE_COPY: LocalizedText = {
  en: 'The campaign is complete: there is no checkpoint to save. Exit to the main menu?',
  zh: '战役已通关，没有需要保存的检查点。返回主菜单？',
};
const SAVE_FAILED_COPY: LocalizedText = {
  en: "Could not save: this browser's storage is unavailable or full.",
  zh: '保存失败：浏览器存储不可用或已满。',
};
/** 菜单自己不存档时（游戏侧没有接“保存并退出”）：任何模式下都成立的说法 */
const UNSAVED_EXIT_COPY: LocalizedText = {
  en: 'Exiting now does not save.',
  zh: '现在退出不会保存。',
};
const STORED_CHECKPOINT_COPY: LocalizedText = {
  en: 'Continue Campaign resumes from the last checkpoint: {position}.',
  zh: '“继续战役”将从上一个检查点开始：{position}。',
};
const NO_CHECKPOINT_COPY: LocalizedText = {
  en: 'No campaign checkpoint is stored.',
  zh: '当前没有战役检查点。',
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
  SaveFailed = 'save-failed',
}

/**
 * 暂停菜单：继续 / 升级 / 运行时音画与语言设置 / 保存并退出（不存档的对局：返回主菜单）确认
 */
export class PauseMenu {
  private readonly options: IPauseMenuOptions;
  private readonly overlay: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private visible = false;
  private view: PauseMenuView = PauseMenuView.Default;
  private settings: StartFlowSettings = { ...DEFAULT_START_FLOW_SETTINGS };
  private readonly unsubscribeLocale: () => void;
  /** 当前确认页是否承诺了存档（主按钮是“保存并退出”） */
  private confirmPromisesSave = false;

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
   * ESC 处理：确认 / 存档失败 / 设置页返回默认视图并消费按键；默认视图交由协调器继续游戏。
   */
  public handleEscape(): boolean {
    if (!this.visible) {
      return false;
    }

    if (this.view !== PauseMenuView.Default) {
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
    } else if (view === PauseMenuView.SaveFailed) {
      this.renderSaveFailedView();
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
    // 只有这一局真的会存档时才叫“保存并退出”；不存档的对局仍是“返回菜单”
    const exitLabel =
      this.readSaveStatus()?.kind === 'saved' ? SAVE_AND_EXIT_LABEL : MAIN_MENU_LABEL;
    actions.appendChild(this.createActionButton(tr(exitLabel), () => this.renderConfirmView()));
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

  /**
   * 退出确认：先如实说明会发生什么（存到哪里 / 不存档）。焦点落在不丢东西的那个按钮上：
   * 会存档时是“保存并退出”，不存档时是“取消”。回车 / 空格激活的就是有焦点的按钮。
   */
  private renderConfirmView(): void {
    const status = this.readSaveStatus();
    if (status?.kind === 'failed') {
      // 游戏侧预告就说存不了：直接进失败页（“仍然退出”不会再尝试存档）
      this.renderSaveFailedView();
      return;
    }
    this.view = PauseMenuView.Confirm;
    this.confirmPromisesSave = status?.kind === 'saved';
    this.panel.replaceChildren();
    this.panel.appendChild(this.createTitle(tr({ en: 'Leave Mission', zh: '离开' })));
    this.panel.appendChild(this.createMessage(this.describeExit(status)));

    const cancel = this.createActionButton(tr({ en: 'Cancel', zh: '取消' }), () =>
      this.renderDefaultView()
    );
    const primary = this.createActionButton(
      tr(this.confirmPromisesSave ? SAVE_AND_EXIT_LABEL : EXIT_LABEL),
      () => this.confirmExit()
    );
    this.panel.appendChild(this.createConfirmActions(cancel, primary));
    (this.confirmPromisesSave ? primary : cancel).focus();
  }

  /** 存档失败：如实告知，并说明此刻退出后“继续战役”还剩什么；焦点落在“返回”上 */
  private renderSaveFailedView(): void {
    this.view = PauseMenuView.SaveFailed;
    this.panel.replaceChildren();
    this.panel.appendChild(this.createTitle(tr({ en: 'Save Failed', zh: '保存失败' })));
    this.panel.appendChild(
      this.createMessage([tr(SAVE_FAILED_COPY), this.describeStoredCheckpoint()])
    );

    const back = this.createActionButton(tr({ en: 'Back', zh: '返回' }), () =>
      this.renderDefaultView()
    );
    const exitAnyway = this.createActionButton(tr({ en: 'Exit Anyway', zh: '仍然退出' }), () =>
      this.options.onExitToMenu()
    );
    this.panel.appendChild(this.createConfirmActions(back, exitAnyway));
    back.focus();
  }

  /** 游戏侧的“保存并退出”预告；两个回调缺一时为 null：菜单自己不存档 */
  private readSaveStatus(): CampaignExitSave | null {
    const { getSaveStatus, onSaveAndExit } = this.options;
    return getSaveStatus && onSaveAndExit ? getSaveStatus() : null;
  }

  /**
   * 确认退出：接了“保存并退出”就先存档——失败停在失败页；确认页说过会存、结果却没存时回到确认页
   * 按最新状态重新说明。只有存档成功或本来就不存档时才真的退出。
   */
  private confirmExit(): void {
    const { getSaveStatus, onSaveAndExit } = this.options;
    if (getSaveStatus && onSaveAndExit) {
      const result = onSaveAndExit();
      if (result.kind === 'failed') {
        this.renderSaveFailedView();
        return;
      }
      if (this.confirmPromisesSave && result.kind !== 'saved') {
        this.renderConfirmView();
        return;
      }
    }
    this.options.onExitToMenu();
  }

  /** 确认页的说明（一到两行）：按真实的存档去向写 */
  private describeExit(status: CampaignExitSave | null): string[] {
    switch (status?.kind) {
      case 'saved':
        return [
          tr(SAVES_AT_COPY, { position: tr(status.position) }),
          tr(CONTINUE_COPY[status.stage]),
        ];
      case 'no-save-mode':
        return [tr(NO_SAVE_MODE_COPY)];
      case 'not-started':
        return [tr(NOT_STARTED_COPY)];
      case 'complete':
        return [tr(CAMPAIGN_COMPLETE_COPY)];
      default:
        return [tr(UNSAVED_EXIT_COPY), this.describeStoredCheckpoint()];
    }
  }

  /** 存储里现有的检查点：菜单没有存档（没接线 / 存档失败）时，“继续战役”就从这里开始 */
  private describeStoredCheckpoint(): string {
    const stored = loadCampaignCheckpoint();
    return stored
      ? tr(STORED_CHECKPOINT_COPY, { position: describeCheckpoint(stored) })
      : tr(NO_CHECKPOINT_COPY);
  }

  private createMessage(lines: readonly string[]): HTMLDivElement {
    const message = document.createElement('div');
    message.style.cssText = `
      font-size: 16px;
      line-height: 1.5;
      text-align: center;
      color: var(--hud-text, ${HUD_COLORS.text});
    `;
    for (const line of lines) {
      const lineEl = document.createElement('div');
      lineEl.textContent = line;
      message.appendChild(lineEl);
    }
    return message;
  }

  /**
   * 确认页的一排两个按钮：返回 / 取消在左，主操作在右。左右方向键（和 Tab）在两个按钮之间移动焦点；
   * 回车 / 空格不接管，交给按钮自己。
   */
  private createConfirmActions(
    safe: HTMLButtonElement,
    primary: HTMLButtonElement
  ): HTMLDivElement {
    const actions = document.createElement('div');
    actions.className = 'pause-actions';
    actions.style.cssText = `
      display: flex;
      flex-direction: row;
      gap: 12px;
      width: 100%;
    `;
    actions.append(safe, primary);
    actions.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        (event.key === 'ArrowLeft' ? safe : primary).focus();
      }
    });
    return actions;
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
