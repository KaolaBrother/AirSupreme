import { GameConfig } from '@/config';
import { unlockAudioFromUserGesture } from '@/core/Audio/AudioContextHost';
import {
  describeCheckpoint,
  loadCampaignCheckpoint,
  type CampaignSaveData,
} from '@/core/save/SaveSystem';
import {
  loadStartFlowSettings,
  saveStartFlowSettings,
  type StartFlowSettings,
} from '@/core/SessionSettings';
import { getLocale, onLocaleChange, setLocale, tr } from '@/i18n';
import { injectHudTokens, prefersReducedMotion } from '@/ui/theme/hudTokens';
import { el, isEditableTarget } from './menu/dom';
import { HowToPlaySheet } from './menu/HowToPlaySheet';
import { MenuBackdrop } from './menu/MenuBackdrop';
import { MenuHero } from './menu/MenuHero';
import { chapterCaption, difficultyText } from './menu/menuLabels';
import { MenuSheet } from './menu/MenuSheet';
import { MENU_CSS } from './menu/menuStyles';
import { SettingsSheet } from './menu/SettingsSheet';
import { SHEET_CSS } from './menu/sheetStyles';
import { TitleScreen, type TitleAction } from './menu/TitleScreen';
import type { ModelPreview } from './ModelPreview';

type ModelPreviewModule = typeof import('./ModelPreview');

/** 入场编排的总时长：之后摘掉 is-entering，悬停 / 按下的位移不再被动画的结束帧压住 */
const ENTRANCE_MS = 1400;
/** “进入战场”过场的时长（与 menuStyles 里的 tm-launch 一致） */
const LAUNCH_MS = 340;

/**
 * 主菜单（标题画面）。
 *
 * 画面：全屏的黄昏云海背景（MenuBackdrop，纯 CSS / 2D 画布）+ 按需加载的实时 3D 主机
 * （MenuHero）+ 标志与少数几个动作（TitleScreen）。设置、操作说明各是一张面板
 * （SettingsSheet / HowToPlaySheet），机库是模型预览（ModelPreview，按需加载）。
 *
 * 对外接口与原来一致：setOnStart / setOnContinue / reloadFromStorage / show / hide / dispose，
 * 根节点 id 仍是 #start-menu；新增 whenLaunched()（见该方法）。
 * 设置的取值范围、存储字段与保存时机不变：每次改动立即 saveStartFlowSettings。
 */
export class StartMenu {
  private readonly container: HTMLDivElement;
  private readonly backdrop: MenuBackdrop;
  private readonly hero: MenuHero;
  private readonly title: TitleScreen;
  private readonly settingsSheet: SettingsSheet;
  private readonly howToSheet: HowToPlaySheet;
  private readonly confirmSheet: MenuSheet;
  private readonly reducedMotion: boolean;

  private onStart?: (settings: GameSettings) => void;
  private onContinue?: (save: CampaignSaveData) => void;
  private settings: GameSettings;
  private save: CampaignSaveData | null;

  private modelPreview: ModelPreview | null = null;
  private modelPreviewPromise: Promise<ModelPreview> | null = null;
  private modelPreviewModulePromise: Promise<ModelPreviewModule> | null = null;
  private preloadTimer: ReturnType<typeof setTimeout> | null = null;
  private hangarLoading = false;
  private inHangar = false;

  private visible = false;
  private isDisposed = false;
  private entranceTimer: ReturnType<typeof setTimeout> | null = null;
  private launching = false;
  private launchTimer: ReturnType<typeof setTimeout> | null = null;
  private launchPromise: Promise<void> | null = null;
  private resolveLaunch: (() => void) | null = null;
  private unsubscribeLocale: (() => void) | null = null;

  private readonly handleKeydown = (event: KeyboardEvent): void => this.onKeydown(event);

  constructor() {
    this.settings = loadStartFlowSettings();
    this.save = loadCampaignCheckpoint();
    this.reducedMotion = prefersReducedMotion();
    injectHudTokens();

    this.container = el('div');
    this.container.id = 'start-menu';
    this.container.classList.toggle('is-reduced', this.reducedMotion);
    const style = document.createElement('style');
    style.textContent = MENU_CSS + SHEET_CSS;
    this.container.append(style);
    // iOS Safari 只有在祖先上注册过触摸监听时才给按钮应用 :active（按下反馈）
    this.container.addEventListener('touchstart', () => undefined, { passive: true });

    this.backdrop = new MenuBackdrop();
    this.hero = new MenuHero(this.backdrop.heroSlot, {
      reducedMotion: this.reducedMotion,
      touchDevice: GameConfig.isMobile,
    });

    this.title = new TitleScreen(
      {
        onAction: (action) => this.handleAction(action),
        onHangarIntent: () => this.preloadModelPreviewModule(),
      },
      { save: this.save, settings: this.settings }
    );

    const onOpenChange = (): void => this.syncSheetState();
    this.settingsSheet = new SettingsSheet(
      {
        getSettings: () => this.settings,
        update: (patch) => this.updateSettings(patch),
      },
      { reducedMotion: this.reducedMotion, onOpenChange }
    );
    this.howToSheet = new HowToPlaySheet({
      reducedMotion: this.reducedMotion,
      defaultView: GameConfig.isMobile ? 'touch' : 'keyboard',
      onOpenChange,
    });
    this.confirmSheet = new MenuSheet({
      id: 'new-campaign-confirm',
      variant: 'dialog',
      reducedMotion: this.reducedMotion,
      onOpenChange,
    });
    this.renderConfirm();

    this.container.append(
      this.backdrop.root,
      this.title.root,
      this.settingsSheet.sheet.layer,
      this.howToSheet.sheet.layer,
      this.confirmSheet.layer
    );
    document.body.appendChild(this.container);

    this.setVisible(true);
    this.scheduleModelPreviewPreload();
    this.unsubscribeLocale = onLocaleChange(() => this.applyLocale());
  }

  // ───────────────────────────── 对外接口 ─────────────────────────────

  public setOnStart(callback: (settings: GameSettings) => void): void {
    this.onStart = callback;
  }

  /** 点击“继续战役”时回调（传入刚读取并校验过的检查点） */
  public setOnContinue(callback: (save: CampaignSaveData) => void): void {
    this.onContinue = callback;
  }

  /**
   * “进入战场”过场（约 0.3 秒：前景收走、主机加力冲出、菜单淡出）播完且菜单已隐藏后兑现。
   * onStart / onContinue 仍在点击的调用栈上同步触发（音频解锁依赖这一点）；调用方想让过场
   * 播完再做耗时的启动工作，就在回调里等这个 Promise。没有过场在播（减少动态效果、或菜单
   * 已被 hide()）时立即兑现。
   */
  public whenLaunched(): Promise<void> {
    return this.launchPromise ?? Promise.resolve();
  }

  public reloadFromStorage(): void {
    this.settings = loadStartFlowSettings();
    // 与原先一致：读回的设置规范化后写回存储
    saveStartFlowSettings(this.settings);
    this.save = loadCampaignCheckpoint();
    this.settingsSheet.sync();
    this.refreshTitle();
  }

  public show(): void {
    this.reloadFromStorage();
    this.settleLaunch(false);
    if (this.inHangar) {
      // 机库还开着就被要求显示菜单：先收起机库（它会回调 resumeFromHangar）
      this.modelPreview?.hide();
    }
    this.setVisible(true);
  }

  public hide(): void {
    if (this.launching) {
      this.settleLaunch(true);
      return;
    }
    this.closeSheets();
    this.setVisible(false);
  }

  public dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    this.settleLaunch(false);
    this.setVisible(false);
    if (this.preloadTimer !== null) {
      clearTimeout(this.preloadTimer);
      this.preloadTimer = null;
    }
    this.unsubscribeLocale?.();
    this.unsubscribeLocale = null;
    this.modelPreview?.dispose();
    this.modelPreview = null;
    this.settingsSheet.dispose();
    this.howToSheet.dispose();
    this.confirmSheet.dispose();
    this.hero.dispose();
    this.backdrop.dispose();
    this.container.remove();
  }

  // ───────────────────────────── 显示 / 隐藏 ─────────────────────────────

  /**
   * 显示：播放入场编排、启动主机与视差、接管键盘。
   * 隐藏：容器 display:none（CSS 动画随之停止）、释放主机的 WebGL 上下文、摘掉监听。
   */
  private setVisible(visible: boolean): void {
    if (this.entranceTimer !== null) {
      clearTimeout(this.entranceTimer);
      this.entranceTimer = null;
    }
    this.container.classList.remove('is-entering');

    if (!visible) {
      this.container.style.display = 'none';
      if (this.visible) {
        this.visible = false;
        document.removeEventListener('keydown', this.handleKeydown);
        this.backdrop.disableParallax();
        this.hero.stop();
      }
      return;
    }

    this.container.style.display = '';
    if (!this.reducedMotion) {
      // 重新触发入场动画：先让“没有 is-entering”的状态生效一帧
      void this.container.offsetWidth;
      this.container.classList.add('is-entering');
      this.entranceTimer = setTimeout(() => {
        this.entranceTimer = null;
        this.container.classList.remove('is-entering');
      }, ENTRANCE_MS);
    }
    if (!this.visible) {
      this.visible = true;
      document.addEventListener('keydown', this.handleKeydown);
      if (!this.reducedMotion) {
        this.backdrop.enableParallax(this.container, (x, y) => this.hero.setPointer(x, y));
      }
      this.hero.start();
    }
  }

  private refreshTitle(): void {
    this.title.update({ save: this.save, settings: this.settings });
  }

  // ───────────────────────────── 设置 ─────────────────────────────

  /** 设置面板改了一项：合并、保存、刷新显示；语言变化时切换界面语言（随后整体重建文案） */
  private updateSettings(patch: Partial<StartFlowSettings>): void {
    const previousLanguage = this.settings.language;
    // 原地修改：已经交给调用方的设置对象（重试用）与菜单里的保持同一份
    Object.assign(this.settings, patch);
    saveStartFlowSettings(this.settings);
    this.settingsSheet.sync();
    this.refreshTitle();
    if (this.settings.language !== previousLanguage) {
      setLocale(this.settings.language);
    }
  }

  /** 语言切换（设置面板或暂停菜单里）：标题画面、三张面板都按新语言重建 */
  private applyLocale(): void {
    if (this.isDisposed) {
      return;
    }
    // 语言也可能在暂停菜单里切换：内存中的设置跟上，避免之后把旧语言写回存储
    this.settings.language = getLocale();
    this.refreshTitle();
    this.settingsSheet.render();
    this.howToSheet.render();
    this.renderConfirm();
  }

  // ───────────────────────────── 动作 ─────────────────────────────

  private handleAction(action: TitleAction): void {
    if (this.launching || this.isDisposed) {
      return;
    }
    switch (action) {
      case 'continue':
        this.continueCampaign();
        break;
      case 'start':
        this.requestNewGame();
        break;
      case 'hangar':
        void this.openHangar();
        break;
      case 'settings':
        this.settingsSheet.open(() => this.title.getButton('settings'));
        break;
      case 'howto':
        this.howToSheet.open(() => this.title.getButton('howto'));
        break;
    }
  }

  private continueCampaign(): void {
    // 重新读取并校验：存档可能在别的标签页里被清掉，或已损坏
    const save = loadCampaignCheckpoint();
    if (!save) {
      this.save = null;
      this.refreshTitle();
      return;
    }
    const onContinue = this.onContinue;
    if (!onContinue) {
      return;
    }
    this.launch(() => onContinue(save));
  }

  /**
   * 开新局。正常模式的新局一启动就会清掉战役检查点（CampaignController.setupNewRun），
   * 从高级选项里选关 / 带测试分数开局也一样；所以只要有存档且是正常模式，就先确认。
   * Boss 模式不读也不写战役存档，直接开始。
   */
  private requestNewGame(): void {
    // 重新读取：存档可能在别的标签页里被清掉，或已损坏
    const save = loadCampaignCheckpoint();
    const existenceChanged = (save === null) !== (this.save === null);
    this.save = save;
    if (existenceChanged) {
      this.refreshTitle();
    }
    if (save && this.settings.gameMode === 'normal') {
      this.renderConfirm();
      this.confirmSheet.open(() => this.title.getButton('start'));
      return;
    }
    this.startGame();
  }

  private startGame(): void {
    const onStart = this.onStart;
    this.launch(() => onStart?.(this.settings));
  }

  /**
   * 进入战场：音频解锁与回调都在点击的调用栈上同步完成；菜单自己播完过场后隐藏
   * （减少动态效果时立刻隐藏）。调用方中途调 hide() 会直接结束过场。
   */
  private launch(run: () => void): void {
    unlockAudioFromUserGesture();
    this.closeSheets();
    if (this.reducedMotion) {
      this.setVisible(false);
      run();
      return;
    }
    this.launching = true;
    this.container.classList.add('is-launching');
    this.hero.launch();
    this.launchPromise = new Promise<void>((resolve) => {
      this.resolveLaunch = resolve;
    });
    this.launchTimer = setTimeout(() => this.settleLaunch(true), LAUNCH_MS);
    run();
  }

  /** 结束过场；hideMenu：同时隐藏菜单（show() 打断过场时不隐藏） */
  private settleLaunch(hideMenu: boolean): void {
    if (!this.launching) {
      return;
    }
    this.launching = false;
    if (this.launchTimer !== null) {
      clearTimeout(this.launchTimer);
      this.launchTimer = null;
    }
    this.container.classList.remove('is-launching');
    const resolve = this.resolveLaunch;
    this.resolveLaunch = null;
    this.launchPromise = null;
    if (hideMenu) {
      this.setVisible(false);
    }
    resolve?.();
  }

  // ───────────────────────────── 面板 ─────────────────────────────

  private openSheets(): MenuSheet[] {
    return [this.confirmSheet, this.howToSheet.sheet, this.settingsSheet.sheet].filter((sheet) =>
      sheet.isOpen()
    );
  }

  /** 有面板打开时，背后的标题画面退后并失去交互（键盘、读屏都进不去） */
  private syncSheetState(): void {
    const open = this.openSheets().length > 0;
    this.container.classList.toggle('has-sheet', open);
    this.title.root.inert = open;
  }

  private closeSheets(): void {
    for (const sheet of this.openSheets()) {
      sheet.close(false);
    }
  }

  /** “新战役”确认框：写明会被覆盖的是哪一份存档；默认焦点在“保留存档”上 */
  private renderConfirm(): void {
    const sheet = this.confirmSheet;
    sheet.setHeading(
      tr({ en: 'New campaign', zh: '新战役' }),
      tr({ en: 'Replace your saved campaign?', zh: '覆盖当前的战役存档？' }),
      tr({ en: 'Cancel', zh: '取消' })
    );
    sheet.panel.setAttribute('aria-describedby', 'new-campaign-confirm-text');

    const text = el(
      'p',
      'cf-text',
      tr({
        en: 'Starting a new campaign erases the checkpoint below. This cannot be undone.',
        zh: '开始新战役会清除下面这份检查点存档，无法恢复。',
      })
    );
    text.id = 'new-campaign-confirm-text';
    const nodes: HTMLElement[] = [text];

    const save = this.save;
    if (save) {
      const card = el('div', 'cf-save');
      card.id = 'new-campaign-confirm-save';
      card.append(
        el('span', 'cf-save-label', tr({ en: 'Saved campaign', zh: '当前存档' })),
        ' ',
        el('span', 'cf-save-title', describeCheckpoint(save)),
        ' ',
        el(
          'span',
          'cf-save-meta',
          tr(
            {
              en: 'Score {score} · {difficulty} · Lives {lives}',
              zh: '得分 {score} · {difficulty} · 生命 {lives}',
            },
            {
              score: save.score,
              difficulty: difficultyText(save.difficulty),
              lives: save.lives,
            }
          )
        )
      );
      nodes.push(card);
    }

    // 新局从哪里开始（高级选项改过起始关卡 / 测试分数时尤其要看得见）
    const startText = el(
      'p',
      'cf-text cf-start',
      tr(
        { en: 'The new run starts at {chapter}.', zh: '新战役从「{chapter}」开始。' },
        { chapter: chapterCaption(this.settings.startLevel) }
      )
    );
    nodes.push(startText);
    sheet.body.replaceChildren(...nodes);

    const cancel = el('button', 'cf-btn', tr({ en: 'Keep my save', zh: '保留存档' }));
    cancel.type = 'button';
    cancel.id = 'new-campaign-cancel';
    cancel.dataset.autofocus = '';
    cancel.addEventListener('click', () => sheet.close());

    const confirm = el(
      'button',
      'cf-btn cf-btn-danger',
      tr({ en: 'Start new campaign', zh: '开始新战役' })
    );
    confirm.type = 'button';
    confirm.id = 'new-campaign-confirm-btn';
    confirm.addEventListener('click', () => {
      if (this.launching) {
        return;
      }
      sheet.close(false);
      this.startGame();
    });

    const actions = el('div', 'cf-actions');
    actions.append(cancel, confirm);
    const hadFocus = sheet.footer.contains(document.activeElement);
    const focusedConfirm = hadFocus && document.activeElement?.id === confirm.id;
    sheet.footer.replaceChildren(actions);
    if (hadFocus) {
      (focusedConfirm ? confirm : cancel).focus({ preventScroll: true });
    }
  }

  // ───────────────────────────── 键盘 ─────────────────────────────

  /**
   * 菜单可见时的全局按键：
   * 面板打开——Esc 关闭最上面那张，Tab 圈在面板里，上下方向键在各行之间移动；
   * 标题画面——焦点不在任何按钮上时，Enter 触发主动作，方向键把焦点放到动作列表上
   * （按钮之间的方向键移动由 TitleScreen 自己处理）。
   */
  private onKeydown(event: KeyboardEvent): void {
    if (!this.visible || this.launching || this.inHangar || event.defaultPrevented) {
      return;
    }
    const sheet = this.openSheets()[0];
    if (sheet) {
      if (event.key === 'Escape') {
        event.preventDefault();
        sheet.close();
        return;
      }
      sheet.handleKeydown(event);
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || isEditableTarget(event.target)) {
      return;
    }
    if (this.title.containsFocus()) {
      return;
    }
    if (event.key === 'Enter') {
      // 按住不放的重复事件不算（例如在结算画面按 Enter 回到菜单时还没松手）
      if (!event.repeat) {
        event.preventDefault();
        this.title.getButton(this.title.getPrimaryAction())?.click();
      }
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.title.focusEdge(1);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      this.title.focusEdge(-1);
    }
  }

  // ───────────────────────────── 机库 ─────────────────────────────

  private scheduleModelPreviewPreload(): void {
    const preload = (): void => {
      this.preloadTimer = null;
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

    this.preloadTimer = setTimeout(preload, 1200);
  }

  private preloadModelPreviewModule(): void {
    if (this.modelPreview || this.modelPreviewPromise || this.modelPreviewModulePromise) {
      return;
    }

    const modulePromise = import('./ModelPreview');
    this.modelPreviewModulePromise = modulePromise;
    // 预加载失败不算错误：点“机库”时会再试一次
    modulePromise.catch(() => {
      if (this.modelPreviewModulePromise === modulePromise) {
        this.modelPreviewModulePromise = null;
      }
    });
  }

  private async ensureModelPreview(): Promise<ModelPreview> {
    if (this.modelPreview) {
      return this.modelPreview;
    }

    if (!this.modelPreviewPromise) {
      const modulePromise = this.modelPreviewModulePromise ?? import('./ModelPreview');
      this.modelPreviewModulePromise = modulePromise;
      this.modelPreviewPromise = modulePromise.then(({ ModelPreview: Preview }) => {
        if (this.isDisposed) {
          throw new Error('StartMenu was disposed; model preview initialization cancelled');
        }
        const preview = new Preview();
        preview.setOnBack(() => this.resumeFromHangar());
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

  /**
   * 进机库：先停掉标题画面的主机（归还它的 WebGL 上下文），再让模型预览创建自己的渲染器，
   * 两个上下文不会同时存在。
   */
  private async openHangar(): Promise<void> {
    if (this.hangarLoading || this.inHangar) {
      return;
    }
    this.hangarLoading = true;
    this.title.setBusy('hangar');
    try {
      const preview = await this.ensureModelPreview();
      if (this.isDisposed || !this.visible || this.launching) {
        return;
      }
      this.inHangar = true;
      this.setVisible(false);
      preview.show();
    } catch (error) {
      if (!this.isDisposed) {
        console.error('Failed to load model preview', error);
      }
    } finally {
      this.hangarLoading = false;
      if (!this.isDisposed) {
        this.title.setBusy(null);
      }
    }
  }

  /** 从机库返回（模型预览已经释放了它的渲染器）：菜单与主机回来，焦点还给“机库”按钮 */
  private resumeFromHangar(): void {
    if (!this.inHangar) {
      return;
    }
    this.inHangar = false;
    if (this.isDisposed) {
      return;
    }
    this.setVisible(true);
    this.title.getButton('hangar')?.focus({ preventScroll: true });
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
