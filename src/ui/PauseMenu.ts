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
import { injectHudTokens } from '@/ui/theme/hudTokens';
import { el, icon } from './menu/dom';
import { MENU_ICONS, type MenuIconName } from './menu/menuIcons';
import { DECREASE_LABEL, INCREASE_LABEL, QUALITY_LABELS, QUALITY_PRESETS } from './menu/menuLabels';
import { menuKitCss, rescopeMenuCss } from './menu/menuStyles';
import { createStepper } from './menu/settingsControls';
import { sheetKitCss } from './menu/sheetStyles';

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
   * 执行存档并返回真实结果。只在预告是 'saved'（确认页写着“保存并退出”）时调用；不存档的对局
   * 直接 onExitToMenu，不会调用它。'saved' 随即调用 onExitToMenu；'failed' 时菜单停在失败页，
   * 由玩家选择仍然退出或返回；其余结果（预告说会存、结果却没存）回到确认页重新说明，不退出。
   */
  onSaveAndExit?: () => CampaignExitSave;
  applyAudio: (sfx: number, music: number) => void;
  /** 角色配音音量 0..1（立即生效）；缺省不显示语音一行 */
  applyVoice?: (voice: number) => void;
  applyQuality: (preset: QualityPreset) => void;
  loadSettings: () => StartFlowSettings;
  saveSettings: (partial: Partial<StartFlowSettings>) => void;
}

const PAUSED_LABEL: LocalizedText = { en: 'Paused', zh: '暂停' };
/** 默认页标题上方的小标签；其余各页的小标签是“暂停”，说明自己是从哪里进来的 */
const STAND_BY_LABEL: LocalizedText = { en: 'Stand by', zh: '待命' };
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
/** 音量读数下方的格数：一格一步 */
const VOLUME_PIPS = 10;
/** 画质 / 语言两行步进按钮的读屏名称（这两行是在选项之间切换，不是增减） */
const PREVIOUS_OPTION_LABEL: LocalizedText = { en: 'Previous {name} option', zh: '{name}：上一项' };
const NEXT_OPTION_LABEL: LocalizedText = { en: 'Next {name} option', zh: '{name}：下一项' };
/** 步进按钮从不变暗：音量到头后再按仍照常应用（值被钳住），画质 / 语言循环切换 */
const NEVER_AT_END = { atMin: false, atMax: false } as const;

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

/** 面板的色调：danger = 这一步会丢进度（顶线与小标签换成琥珀色） */
type PauseTone = 'normal' | 'danger';
/** 设置 / 确认 / 失败页按钮的样子：plain 次要、primary 冰蓝主操作、danger 琥珀色 */
type DialogButtonKind = 'plain' | 'primary' | 'danger';

const PAUSE_SCOPE = '#pause-menu';

/**
 * 暂停菜单自己的版式：遮罩、面板、各页的间距与矮屏时的压缩。按钮、标题、存档卡片、设置行的样子
 * 都来自主菜单的共用片段（menuKitCss / sheetKitCss 换到 #pause-menu 下），这里只做摆放和少量覆盖。
 * 这段文字会算进 #pause-menu 的 textContent，所以里面不写注释。
 */
const PAUSE_CSS = `
#pause-menu {
  z-index: 200;
  padding: env(safe-area-inset-top) env(safe-area-inset-right)
    env(safe-area-inset-bottom) env(safe-area-inset-left);
  background: rgba(2, 6, 13, 0.66);
  -webkit-backdrop-filter: blur(10px) saturate(0.8);
  backdrop-filter: blur(10px) saturate(0.8);
  color: var(--tm-text);
  font-family: var(--tm-font);
  -webkit-tap-highlight-color: transparent;
  -webkit-user-select: none;
  user-select: none;
  touch-action: manipulation;
}

#pause-menu .pause-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(360px, calc(100% - 32px));
  max-width: 360px;
  max-height: calc(100% - 24px);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  scrollbar-width: thin;
  scrollbar-color: rgba(143, 228, 255, 0.35) transparent;
  background: var(--tm-panel);
  border: 1px solid rgba(143, 228, 255, 0.36);
  border-top: 2px solid var(--tm-ice);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.65);
}

#pause-menu .pause-panel[data-tone='danger'] {
  border-top-color: var(--tm-amber);
}

#pause-menu .pause-panel[data-tone='danger'] .ms-kicker {
  color: var(--tm-amber);
}

#pause-menu .pause-panel[data-tone='danger'] .ms-kicker::before {
  background: var(--tm-amber);
}

#pause-menu .pause-head {
  flex: none;
  padding: 20px 20px 14px;
  border-bottom: 1px solid rgba(143, 228, 255, 0.16);
}

#pause-menu .ms-title {
  font-size: 25px;
}

#pause-menu .pause-body {
  flex: none;
  padding: 16px 20px 0;
}

#pause-menu .pause-actions {
  flex: none;
  padding: 16px 20px 20px;
}

#pause-menu .pause-panel[data-view='default'] .pause-actions {
  display: flex;
  flex-direction: column;
  padding-bottom: 12px;
}

#pause-menu .tm-primary {
  min-height: 66px;
  margin-bottom: 8px;
}

#pause-menu .tm-action:last-child {
  border-bottom: 0;
}

#pause-menu .pause-panel[data-view='settings'] .pause-body {
  padding-top: 4px;
}

#pause-menu .st-row {
  gap: 8px 10px;
}

#pause-menu .st-row:last-child {
  border-bottom: 0;
}

#pause-menu .st-label {
  font-size: 14.5px;
  letter-spacing: 0.02em;
  line-height: 1.25;
}

#pause-menu .st-readout {
  width: 104px;
  min-width: 0;
  padding: 0;
}

#pause-menu .st-value {
  font-size: 15px;
  letter-spacing: 0.02em;
}

#pause-menu .st-pip {
  width: 6px;
}

#pause-menu .pause-panel[data-view='settings'] .pause-actions {
  display: flex;
  padding-top: 12px;
  border-top: 1px solid rgba(143, 228, 255, 0.16);
}

#pause-menu .cf-save {
  margin: 0 0 12px;
  border-color: rgba(143, 228, 255, 0.34);
  border-left-color: var(--tm-ice);
  background: rgba(143, 228, 255, 0.07);
}

#pause-menu .cf-save-label {
  color: var(--tm-ice);
}

#pause-menu .cf-text + .cf-text {
  margin-top: 8px;
}

#pause-menu .pause-tail {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (max-width: 420px) {
  #pause-menu .pause-head,
  #pause-menu .pause-body,
  #pause-menu .pause-actions {
    padding-left: 16px;
    padding-right: 16px;
  }
}

@media (orientation: landscape) and (max-height: 520px) {
  #pause-menu .pause-panel {
    max-height: calc(100% - 16px);
  }

  #pause-menu .pause-head {
    padding: 11px 20px 9px;
  }

  #pause-menu .ms-kicker {
    display: none;
  }

  #pause-menu .ms-title {
    margin-top: 0;
    font-size: 20px;
  }

  #pause-menu .pause-body {
    padding-top: 10px;
  }

  #pause-menu .pause-actions {
    padding-top: 10px;
    padding-bottom: 12px;
  }

  #pause-menu .pause-panel[data-view='default'] .pause-actions {
    padding-bottom: 8px;
  }

  #pause-menu .tm-primary {
    min-height: 54px;
    margin-bottom: 4px;
    padding-top: 6px;
    padding-bottom: 6px;
  }

  #pause-menu .tm-primary-icon {
    width: 38px;
    height: 38px;
    padding: 9px;
  }

  #pause-menu .tm-primary-label {
    font-size: 17px;
  }

  #pause-menu .tm-action {
    height: 44px;
  }

  #pause-menu .pause-panel[data-view='settings'] .pause-body {
    padding-top: 0;
  }

  #pause-menu .st-row {
    min-height: 50px;
    padding: 2px 0;
  }

  #pause-menu .pause-panel[data-view='settings'] .pause-actions {
    padding-top: 8px;
    padding-bottom: 10px;
  }

  #pause-menu .cf-save {
    margin-bottom: 8px;
    padding: 8px 12px;
  }

  #pause-menu .cf-text {
    font-size: 14px;
    line-height: 1.45;
  }
}
`;

/**
 * 暂停菜单：继续 / 升级 / 运行时音画与语言设置 / 保存并退出（不存档的对局：返回主菜单）确认。
 * 外观沿用主菜单的那一套：深海军蓝面板、小标签 + 粗体大写标题、冰蓝的切角主按钮；
 * 琥珀色只留给会丢进度的那一步。菜单立即出现，不做入场动画。
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
    // 定位、层级与显隐写在行内（show / hide 只切换 display）；其余外观在下面的 <style> 里
    this.overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 200;
      display: none;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    `;

    // 样式放在遮罩自己里面：dispose 时随遮罩一起移除，不在文档里留下任何东西
    const style = document.createElement('style');
    style.textContent = rescopeMenuCss(menuKitCss() + sheetKitCss(), PAUSE_SCOPE) + PAUSE_CSS;

    this.panel = document.createElement('div');
    this.panel.className = 'pause-panel';
    // 菜单里按钮的点击到此为止，不再冒泡到 document 上的对局输入监听
    this.panel.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('button')) {
        event.preventDefault();
        event.stopPropagation();
      }
    });

    this.overlay.appendChild(style);
    this.overlay.appendChild(this.panel);
    document.body.appendChild(this.overlay);
    this.renderDefaultView();
    // 语言切换后按新语言重绘当前视图（停留在原来的页面）
    this.unsubscribeLocale = onLocaleChange(() => this.redrawForLocale());
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

  /**
   * 语言切换：按新语言重绘当前视图。确认 / 失败页上玩家已经移到的那个按钮（左 / 右）重绘后仍然
   * 有焦点；初始焦点规则只在打开页面时决定焦点。
   */
  private redrawForLocale(): void {
    const focused = this.confirmButtons().findIndex((button) => button === document.activeElement);
    this.renderView(this.view);
    if (focused >= 0) {
      this.confirmButtons()[focused]?.focus();
    }
  }

  /** 确认 / 失败页的一排两个按钮（[左, 右]）；其他页面为空 */
  private confirmButtons(): HTMLButtonElement[] {
    if (this.view !== PauseMenuView.Confirm && this.view !== PauseMenuView.SaveFailed) {
      return [];
    }
    return Array.from(this.panel.querySelectorAll<HTMLButtonElement>('.pause-actions button'));
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

  /** 换一页：小标签 + 标题，下面接这一页的各段内容 */
  private renderPanel(
    view: PauseMenuView,
    title: string,
    sections: readonly HTMLElement[],
    tone: PauseTone = 'normal'
  ): void {
    this.view = view;
    this.panel.dataset.view = view;
    this.panel.dataset.tone = tone;
    const head = el('header', 'pause-head');
    head.append(
      el('div', 'ms-kicker', tr(view === PauseMenuView.Default ? STAND_BY_LABEL : PAUSED_LABEL)),
      el('h2', 'ms-title', title)
    );
    this.panel.replaceChildren(head, ...sections);
  }

  private renderDefaultView(): void {
    const actions = el('div', 'pause-actions');
    // 只有这一局真的会存档时才叫“保存并退出”；不存档的对局仍是“返回菜单”
    const exitLabel =
      this.readSaveStatus()?.kind === 'saved' ? SAVE_AND_EXIT_LABEL : MAIN_MENU_LABEL;
    actions.append(
      this.createPrimaryButton(tr({ en: 'Resume', zh: '继续' }), () => this.options.onContinue()),
      this.createActionButton(tr({ en: 'Upgrades', zh: '升级' }), 'upgrade', () =>
        this.options.onUpgrade()
      ),
      this.createActionButton(tr({ en: 'Settings', zh: '设置' }), 'settings', () =>
        this.renderSettingsView()
      ),
      this.createActionButton(tr(exitLabel), 'exit', () => this.renderConfirmView())
    );
    this.renderPanel(PauseMenuView.Default, tr(PAUSED_LABEL), [actions]);
  }

  private renderSettingsView(): void {
    const body = el('div', 'pause-body');
    body.append(this.createVolumeRow('sfx'), this.createVolumeRow('music'));
    if (this.options.applyVoice) {
      body.append(this.createVolumeRow('voice'));
    }
    body.append(this.createQualityRow(), this.createLanguageRow());

    const actions = el('div', 'pause-actions');
    actions.append(
      this.createDialogButton(tr({ en: 'Back', zh: '返回' }), 'plain', () =>
        this.renderDefaultView()
      )
    );
    this.renderPanel(PauseMenuView.Settings, tr({ en: 'Settings', zh: '设置' }), [body, actions]);
  }

  /**
   * 退出确认：先如实说明会发生什么（存到哪里 / 不存档）。焦点落在不丢东西的那个按钮上：
   * 会存档时是“保存并退出”，不存档时是“取消”。回车 / 空格激活的就是有焦点的按钮。
   * 会存档时主按钮是冰蓝色；琥珀色只用在真的会丢进度的对局上（不存档的模式、菜单没接存档）。
   */
  private renderConfirmView(): void {
    const status = this.readSaveStatus();
    if (status?.kind === 'failed') {
      // 游戏侧预告就说存不了：直接进失败页（“仍然退出”不会再尝试存档）
      this.renderSaveFailedView();
      return;
    }
    this.confirmPromisesSave = status?.kind === 'saved';
    const discardsProgress = status === null || status.kind === 'no-save-mode';

    const body = el('div', 'pause-body');
    if (status?.kind === 'saved') {
      body.append(
        this.createSaveCard(tr(status.position)),
        this.createText(tr(CONTINUE_COPY[status.stage]))
      );
    } else {
      body.append(...this.describeUnsavedExit(status).map((line) => this.createText(line)));
    }

    const cancel = this.createDialogButton(tr({ en: 'Cancel', zh: '取消' }), 'plain', () =>
      this.renderDefaultView()
    );
    const primary = this.createDialogButton(
      tr(this.confirmPromisesSave ? SAVE_AND_EXIT_LABEL : EXIT_LABEL),
      discardsProgress ? 'danger' : 'primary',
      () => this.confirmExit()
    );
    this.renderPanel(
      PauseMenuView.Confirm,
      tr({ en: 'Leave Mission', zh: '离开' }),
      [body, this.createConfirmActions(cancel, primary)],
      discardsProgress ? 'danger' : 'normal'
    );
    (this.confirmPromisesSave ? primary : cancel).focus();
  }

  /** 存档失败：如实告知，并说明此刻退出后“继续战役”还剩什么；焦点落在“返回”上 */
  private renderSaveFailedView(): void {
    const body = el('div', 'pause-body');
    body.append(
      this.createText(tr(SAVE_FAILED_COPY)),
      this.createText(this.describeStoredCheckpoint())
    );

    const back = this.createDialogButton(tr({ en: 'Back', zh: '返回' }), 'plain', () =>
      this.renderDefaultView()
    );
    const exitAnyway = this.createDialogButton(
      tr({ en: 'Exit Anyway', zh: '仍然退出' }),
      'danger',
      () => this.options.onExitToMenu()
    );
    this.renderPanel(
      PauseMenuView.SaveFailed,
      tr({ en: 'Save Failed', zh: '保存失败' }),
      [body, this.createConfirmActions(back, exitAnyway)],
      'danger'
    );
    back.focus();
  }

  /** 游戏侧的“保存并退出”预告；两个回调缺一时为 null：菜单自己不存档 */
  private readSaveStatus(): CampaignExitSave | null {
    const { getSaveStatus, onSaveAndExit } = this.options;
    return getSaveStatus && onSaveAndExit ? getSaveStatus() : null;
  }

  /**
   * 确认退出：确认页说了会存才去存档——失败停在失败页；结果却没存时回到确认页按最新状态重新说明。
   * 确认页说了不存档（或游戏侧没有接“保存并退出”）就只退出，不发起存档。
   */
  private confirmExit(): void {
    const { onSaveAndExit } = this.options;
    if (this.confirmPromisesSave && onSaveAndExit) {
      const result = onSaveAndExit();
      if (result.kind === 'failed') {
        this.renderSaveFailedView();
        return;
      }
      if (result.kind !== 'saved') {
        this.renderConfirmView();
        return;
      }
    }
    this.options.onExitToMenu();
  }

  /** 不存档时确认页的说明（一到两行）：如实说明为什么不存 */
  private describeUnsavedExit(status: CampaignExitSave | null): string[] {
    switch (status?.kind) {
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

  /**
   * 存档位置卡片：“存档位置”作小标签，检查点描述作正文。文字仍是 SAVES_AT_COPY 那一句
   * （按 {position} 拆成前后两段，句末标点只留给读屏）。
   */
  private createSaveCard(position: string): HTMLDivElement {
    const [lead, tail = ''] = tr(SAVES_AT_COPY).split('{position}');
    const card = el('div', 'cf-save');
    card.append(
      el('span', 'cf-save-label', lead),
      el('span', 'cf-save-title', position),
      el('span', 'pause-tail', tail)
    );
    return card;
  }

  private createText(text: string): HTMLParagraphElement {
    return el('p', 'cf-text', text);
  }

  /**
   * 确认页的一排两个按钮：返回 / 取消在左，主操作在右。左右方向键（和 Tab）在两个按钮之间移动焦点；
   * 回车 / 空格不接管，交给按钮自己。
   */
  private createConfirmActions(
    safe: HTMLButtonElement,
    primary: HTMLButtonElement
  ): HTMLDivElement {
    const actions = el('div', 'pause-actions cf-actions');
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
    const name = tr(VOLUME_LABELS[bus]);
    const sync = (): void => {
      const volume = this.clampVolume(this.getVolume(bus));
      stepper.set(this.formatVolume(volume), {
        ...NEVER_AT_END,
        pipsOn: Math.round(volume * VOLUME_PIPS),
      });
    };
    const stepper = createStepper({
      key: `pause-${bus}`,
      decreaseLabel: tr(DECREASE_LABEL, { name }),
      increaseLabel: tr(INCREASE_LABEL, { name }),
      pips: VOLUME_PIPS,
      arrowKeys: false,
      onStep: (direction) => {
        this.adjustVolume(bus, direction);
        sync();
      },
    });
    sync();

    const row = this.createSettingRow(name, stepper.root);
    row.setAttribute('data-setting', bus);
    return row;
  }

  private getVolume(bus: VolumeBus): number {
    if (bus === 'sfx') return this.settings.sfxVolume;
    if (bus === 'music') return this.settings.musicVolume;
    return this.settings.voiceVolume;
  }

  private createQualityRow(): HTMLDivElement {
    const name = tr({ en: 'Graphics', zh: '画质' });
    const sync = (): void =>
      stepper.set(this.getQualityLabel(this.settings.qualityPreset), NEVER_AT_END);
    const stepper = createStepper({
      key: 'pause-quality',
      decreaseLabel: tr(PREVIOUS_OPTION_LABEL, { name }),
      increaseLabel: tr(NEXT_OPTION_LABEL, { name }),
      arrowKeys: false,
      onStep: (direction) => {
        this.adjustQuality(direction);
        sync();
      },
    });
    sync();
    return this.createSettingRow(name, stepper.root);
  }

  /** 语言：选项名用各语言自称；切换立即生效并持久化，界面随 onLocaleChange 重绘 */
  private createLanguageRow(): HTMLDivElement {
    const name = tr({ en: 'Language', zh: '语言' });
    const sync = (): void => stepper.set(LANGUAGE_ENDONYMS[this.settings.language], NEVER_AT_END);
    const stepper = createStepper({
      key: 'pause-language',
      decreaseLabel: tr(PREVIOUS_OPTION_LABEL, { name }),
      increaseLabel: tr(NEXT_OPTION_LABEL, { name }),
      arrowKeys: false,
      onStep: (direction) => this.changeLanguage(direction, sync),
    });
    sync();

    const row = this.createSettingRow(name, stepper.root);
    row.setAttribute('data-setting', 'language');
    return row;
  }

  /** 一行设置：左边标签，右边 [-] 数值 [+]（主菜单设置面板的同一种行与步进器） */
  private createSettingRow(label: string, control: HTMLElement): HTMLDivElement {
    const row = el('div', 'st-row');
    const text = el('div', 'st-row-text');
    text.append(el('span', 'st-label', label));
    const slot = el('div', 'st-row-control');
    slot.append(control);
    // 空白文本节点不参与排版，只让 textContent / 读屏里标签与数值分成两个词
    row.append(text, ' ', slot);
    return row;
  }

  /** 默认页的主按钮：标题画面的那块冰蓝切角实块 */
  private createPrimaryButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = el('button', 'tm-primary');
    button.type = 'button';
    const text = el('span', 'tm-primary-text');
    text.append(el('span', 'tm-primary-label', label));
    button.append(
      icon(MENU_ICONS.play, 'mi tm-primary-icon'),
      text,
      icon(MENU_ICONS.chevronRight, 'mi tm-go')
    );
    button.addEventListener('click', onClick);
    return button;
  }

  /** 默认页的次级动作：图标 + 文字的一行（标题画面的同一种动作行） */
  private createActionButton(
    label: string,
    glyph: MenuIconName,
    onClick: () => void
  ): HTMLButtonElement {
    const button = el('button', 'tm-action');
    button.type = 'button';
    const inner = el('span', 'tm-action-inner');
    inner.append(
      icon(MENU_ICONS[glyph], 'mi tm-action-icon'),
      el('span', 'tm-action-label', label)
    );
    button.append(inner, icon(MENU_ICONS.chevronRight, 'mi tm-go'));
    button.addEventListener('click', onClick);
    return button;
  }

  /** 设置 / 确认 / 失败页底部的按钮（主菜单确认框的同一种按钮） */
  private createDialogButton(
    label: string,
    kind: DialogButtonKind,
    onClick: () => void
  ): HTMLButtonElement {
    const button = el('button', kind === 'plain' ? 'cf-btn' : `cf-btn cf-btn-${kind}`, label);
    button.type = 'button';
    button.addEventListener('click', onClick);
    return button;
  }

  private adjustVolume(bus: VolumeBus, direction: 1 | -1): void {
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
  }

  private adjustQuality(direction: 1 | -1): void {
    const next = this.stepQuality(this.settings.qualityPreset, direction);
    this.settings.qualityPreset = next;
    this.options.applyQuality(next);
    this.options.saveSettings({ qualityPreset: next });
  }

  private changeLanguage(direction: 1 | -1, syncRow: () => void): void {
    const next = stepLanguage(this.settings.language, direction);
    this.settings.language = next;
    this.options.saveSettings({ language: next });
    syncRow();
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
