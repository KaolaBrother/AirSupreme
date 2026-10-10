import { describeCheckpoint, type CampaignSaveData } from '@/core/save/SaveSystem';
import { type StartFlowSettings } from '@/core/SessionSettings';
import { TOTAL_LEVELS } from '@/features/campaign/CampaignData';
import { tr } from '@/i18n';
import { el, icon, isEditableTarget } from './dom';
import { MENU_ICONS, type MenuIconName } from './menuIcons';
import { difficultyText, levelText, newGameDetail, newGameLabel } from './menuLabels';

/**
 * 标题画面的前景：标志（AIR SUPREME / 天穹之战）+ 少数几个动作 + 底部按键提示。
 * 有战役存档时“继续战役”是主按钮、排在最前；没有存档时“新战役”是主按钮。
 * 这里不放任何设置项——设置、操作说明各自是一张面板，机库是模型预览。
 */

export type TitleAction = 'continue' | 'start' | 'hangar' | 'settings' | 'howto';

export interface TitleScreenHandlers {
  onAction: (action: TitleAction, button: HTMLButtonElement) => void;
  /** 指针移到 / 焦点落到“机库”上：预加载模型预览模块 */
  onHangarIntent: () => void;
}

export interface TitleScreenState {
  save: CampaignSaveData | null;
  settings: StartFlowSettings;
}

const ACTION_IDS: Readonly<Record<TitleAction, string>> = {
  continue: 'continue-btn',
  start: 'start-btn',
  hangar: 'preview-btn',
  settings: 'settings-btn',
  howto: 'howto-btn',
};

export class TitleScreen {
  public readonly root: HTMLDivElement;

  private readonly kicker: HTMLParagraphElement;
  private readonly tagline: HTMLSpanElement;
  private readonly actions: HTMLElement;
  private readonly hints: HTMLDivElement;
  private state: TitleScreenState;
  private busy: TitleAction | null = null;

  constructor(
    private readonly handlers: TitleScreenHandlers,
    initial: TitleScreenState
  ) {
    this.state = initial;
    this.root = el('div', 'tm-stage');

    // ── 标志 ──
    const brand = el('header', 'tm-brand');
    this.kicker = el('p', 'tm-kicker');
    const logo = el('h1', 'tm-logo menu-title');
    logo.setAttribute('aria-label', 'Air Supreme');
    const top = el('span', 'tm-logo-top');
    top.setAttribute('aria-hidden', 'true');
    top.append(el('span', 'tm-logo-air', 'AIR'), el('span', 'tm-logo-rule'));
    const main = el('span', 'tm-logo-main', 'SUPREME');
    main.setAttribute('aria-hidden', 'true');
    logo.append(top, main);
    const taglineRow = el('p', 'tm-tagline menu-subtitle');
    this.tagline = el('span', 'tm-tagline-text');
    taglineRow.append(this.tagline);
    brand.append(this.kicker, logo, taglineRow);

    // ── 动作 ──
    this.actions = el('nav', 'tm-actions');
    this.actions.addEventListener('keydown', (event) => this.handleActionKeys(event));

    // ── 底部提示 ──
    this.hints = el('div', 'tm-hints');
    this.hints.setAttribute('aria-hidden', 'true');
    const footer = el('footer', 'tm-footer');
    footer.append(this.hints);

    this.root.append(brand, this.actions, footer);
    this.render();
  }

  /** 存档 / 设置变化后刷新（文字与主次关系都可能变） */
  public update(state: TitleScreenState): void {
    this.state = state;
    this.render();
  }

  /** 机库模块加载中：按钮显示“加载中”并不可点 */
  public setBusy(action: TitleAction | null): void {
    this.busy = action;
    this.render();
  }

  public getButton(action: TitleAction): HTMLButtonElement | null {
    return this.actions.querySelector<HTMLButtonElement>(`#${ACTION_IDS[action]}`);
  }

  /** 当前的主动作：有存档是“继续战役”，否则是开新局 */
  public getPrimaryAction(): TitleAction {
    return this.state.save ? 'continue' : 'start';
  }

  public focusPrimary(): void {
    this.getButton(this.getPrimaryAction())?.focus({ preventScroll: true });
  }

  /** 按当前语言与状态重建动作列表；焦点在某个按钮上时放回同一个按钮 */
  public render(): void {
    const active = document.activeElement;
    const focusedId =
      active instanceof HTMLElement && this.actions.contains(active) ? active.id : null;

    this.kicker.textContent = tr({
      en: '7th Wing · Callsign Falcon',
      zh: '第七飞行联队 · 呼号「猎鹰」',
    });
    this.tagline.textContent = tr({ en: 'The Skydome War', zh: '天穹之战' });
    this.actions.setAttribute('aria-label', tr({ en: 'Main menu', zh: '主菜单' }));

    const { save, settings } = this.state;
    const primary = this.getPrimaryAction();
    // 继续战役：始终在 DOM 里，没有存档时隐藏
    const nodes: HTMLElement[] = [this.createContinueButton(save)];
    const list = el('div', 'tm-secondary');
    if (primary === 'start') {
      nodes.push(
        this.createPrimaryButton(
          'start',
          MENU_ICONS.campaign,
          newGameLabel(settings),
          newGameDetail(settings),
          null
        )
      );
    } else {
      list.append(
        this.createSecondaryButton('start', 'campaign', newGameLabel(settings), this.startNote())
      );
    }
    list.append(
      this.createSecondaryButton(
        'hangar',
        'hangar',
        this.busy === 'hangar'
          ? tr({ en: 'Loading…', zh: '加载中...' })
          : tr({ en: 'Hangar', zh: '机库' })
      ),
      this.createSecondaryButton('settings', 'settings', tr({ en: 'Settings', zh: '设置' })),
      this.createSecondaryButton('howto', 'manual', tr({ en: 'How to Play', zh: '操作说明' }))
    );
    nodes.push(list);

    this.actions.replaceChildren(...nodes);
    this.renderHints();

    if (focusedId) {
      this.actions.querySelector<HTMLElement>(`#${focusedId}`)?.focus({ preventScroll: true });
    }
  }

  // ───────────────────────────── 按钮 ─────────────────────────────

  private bind(button: HTMLButtonElement, action: TitleAction): void {
    button.type = 'button';
    button.id = ACTION_IDS[action];
    button.dataset.action = action;
    if (this.busy === action) {
      button.disabled = true;
    }
    button.addEventListener('click', () => {
      if (!button.disabled) {
        this.handlers.onAction(action, button);
      }
    });
    if (action === 'hangar') {
      button.addEventListener('pointerenter', () => this.handlers.onHangarIntent());
      button.addEventListener('focus', () => this.handlers.onHangarIntent());
    }
  }

  private createPrimaryButton(
    action: TitleAction,
    glyph: string,
    label: string,
    detail: string,
    meta: string | null
  ): HTMLButtonElement {
    const button = el('button', 'tm-primary');
    this.bind(button, action);
    const text = el('span', 'tm-primary-text');
    const labelEl = el('span', 'tm-primary-label', label);
    const detailEl = el('span', 'tm-primary-detail', detail);
    // flex 纵列里空白节点不参与排版，只让无障碍名称里几段文字之间有空格
    text.append(labelEl, ' ', detailEl);
    if (meta !== null) {
      text.append(' ', el('span', 'tm-primary-meta', meta));
    }
    button.append(
      icon(glyph, 'mi tm-primary-icon'),
      text,
      icon(MENU_ICONS.chevronRight, 'mi tm-go')
    );
    return button;
  }

  /** “继续战役”：章节 · 关卡标题 · 波次（存档描述）+ 得分 / 难度 / 生命 + 十关航线进度 */
  private createContinueButton(save: CampaignSaveData | null): HTMLButtonElement {
    if (!save) {
      const hidden = el('button', 'tm-primary');
      this.bind(hidden, 'continue');
      hidden.style.display = 'none';
      hidden.tabIndex = -1;
      return hidden;
    }
    const button = this.createPrimaryButton(
      'continue',
      MENU_ICONS.play,
      tr({ en: 'Continue Campaign', zh: '继续战役' }),
      describeCheckpoint(save),
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
    );
    button.querySelector('.tm-primary-detail')?.setAttribute('id', 'continue-detail');
    button.querySelector('.tm-primary-meta')?.setAttribute('id', 'continue-meta');

    // 战役航线：十个航路点，已完成 / 当前 / 未到达
    const route = el('span', 'tm-route');
    route.setAttribute('aria-hidden', 'true');
    for (let level = 1; level <= TOTAL_LEVELS; level++) {
      const waypoint = el('span', 'tm-waypoint');
      if (level < save.level) {
        waypoint.classList.add('is-done');
      } else if (level === save.level) {
        waypoint.classList.add('is-current');
      }
      route.append(waypoint);
    }
    button.querySelector('.tm-primary-text')?.append(route);
    return button;
  }

  private createSecondaryButton(
    action: TitleAction,
    glyph: MenuIconName,
    label: string,
    note: string | null = null
  ): HTMLButtonElement {
    const button = el('button', 'tm-action');
    this.bind(button, action);
    const inner = el('span', 'tm-action-inner');
    inner.append(
      icon(MENU_ICONS[glyph], 'mi tm-action-icon'),
      el('span', 'tm-action-label', label)
    );
    if (note) {
      inner.append(' ', el('span', 'tm-action-note', note));
    }
    button.append(inner, icon(MENU_ICONS.chevronRight, 'mi tm-go'));
    return button;
  }

  /** 次级的“新战役”按钮旁的小注：高级选项改过起始关卡 / 测试分数时写出来 */
  private startNote(): string | null {
    const { settings } = this.state;
    const parts: string[] = [];
    if (settings.startLevel > 1) {
      parts.push(levelText(settings.startLevel));
    }
    if (settings.testScore > 0) {
      parts.push(`+${settings.testScore}`);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }

  private renderHints(): void {
    const hint = (keys: readonly string[], text: string): HTMLSpanElement => {
      const node = el('span', 'tm-hint');
      for (const key of keys) {
        node.append(el('kbd', 'tm-key', key));
      }
      node.append(el('span', 'tm-hint-text', text));
      return node;
    };
    this.hints.replaceChildren(
      hint(['↑', '↓'], tr({ en: 'Navigate', zh: '移动' })),
      hint(['Enter'], tr({ en: 'Select', zh: '确定' }))
    );
  }

  // ───────────────────────────── 键盘 ─────────────────────────────

  private visibleButtons(): HTMLButtonElement[] {
    return Array.from(this.actions.querySelectorAll<HTMLButtonElement>('button')).filter(
      (button) => button.style.display !== 'none' && !button.disabled
    );
  }

  /** 方向键 / Home / End 在动作之间移动焦点 */
  private handleActionKeys(event: KeyboardEvent): void {
    if (isEditableTarget(event.target)) {
      return;
    }
    const buttons = this.visibleButtons();
    if (buttons.length === 0) {
      return;
    }
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        next = index < 0 ? 0 : (index + 1) % buttons.length;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        next = index < 0 ? buttons.length - 1 : (index - 1 + buttons.length) % buttons.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = buttons.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    buttons[next].focus({ preventScroll: true });
  }

  /** 焦点不在任何动作上时按方向键：落到主按钮 / 最后一个按钮 */
  public focusEdge(direction: 1 | -1): void {
    const buttons = this.visibleButtons();
    if (buttons.length === 0) {
      return;
    }
    buttons[direction === 1 ? 0 : buttons.length - 1].focus({ preventScroll: true });
  }

  public containsFocus(): boolean {
    const active = document.activeElement;
    return active instanceof HTMLElement && this.actions.contains(active);
  }
}
