import { el, getTabbable, icon } from './dom';
import { MENU_ICONS } from './menuIcons';

/**
 * 主菜单的面板容器：设置、操作说明（侧边 / 底部面板）与确认对话框（居中卡片）共用。
 * 负责对话框语义（role / aria-modal / 标题关联）、开合动画、焦点圈定与归还、
 * 方向键在各行之间移动焦点。内容由调用方写进 body / footer。
 */

export type MenuSheetVariant = 'panel' | 'dialog';

/**
 * 关闭后焦点还给谁：触发它的按钮，或一个取按钮的函数
 * （语言切换会重建标题画面的按钮，关闭时要拿到新的那一个）。
 */
export type SheetOpener = HTMLElement | (() => HTMLElement | null) | null;

export interface MenuSheetOptions {
  /** 面板元素的 id（标题 id 为 `${id}-title`） */
  id: string;
  variant: MenuSheetVariant;
  /** 减少动态效果：开合不做过渡 */
  reducedMotion: boolean;
  /** 打开 / 关闭时通知（菜单据此让背后的标题画面失去交互） */
  onOpenChange?: (open: boolean) => void;
}

/** 关闭过渡的时长（与 sheetStyles 里的 transition 一致） */
const CLOSE_MS = 260;

export class MenuSheet {
  public readonly layer: HTMLDivElement;
  public readonly panel: HTMLElement;
  public readonly body: HTMLDivElement;
  public readonly footer: HTMLDivElement;

  private readonly kicker: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private readonly closeButton: HTMLButtonElement;
  private opener: SheetOpener = null;
  private opened = false;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: MenuSheetOptions) {
    this.layer = el('div', 'ms-layer');
    this.layer.dataset.variant = options.variant;
    this.layer.hidden = true;

    const scrim = el('div', 'ms-scrim');
    scrim.addEventListener('click', () => this.close());

    this.panel = el('section', 'ms-panel');
    this.panel.id = options.id;
    this.panel.setAttribute('role', options.variant === 'dialog' ? 'alertdialog' : 'dialog');
    this.panel.setAttribute('aria-modal', 'true');
    this.panel.setAttribute('aria-labelledby', `${options.id}-title`);
    this.panel.tabIndex = -1;

    const head = el('header', 'ms-head');
    const heading = el('div', 'ms-heading');
    this.kicker = el('div', 'ms-kicker');
    this.title = el('h2', 'ms-title');
    this.title.id = `${options.id}-title`;
    heading.append(this.kicker, this.title);
    this.closeButton = el('button', 'ms-close');
    this.closeButton.type = 'button';
    this.closeButton.append(icon(MENU_ICONS.close));
    this.closeButton.addEventListener('click', () => this.close());
    head.append(heading, this.closeButton);

    this.body = el('div', 'ms-body');
    this.footer = el('div', 'ms-foot');
    this.panel.append(head, this.body, this.footer);
    this.layer.append(scrim, this.panel);
  }

  /** 标题区文字（语言切换后重新调用） */
  public setHeading(kicker: string, title: string, closeLabel: string): void {
    this.kicker.textContent = kicker;
    this.title.textContent = title;
    this.closeButton.setAttribute('aria-label', closeLabel);
  }

  public isOpen(): boolean {
    return this.opened;
  }

  /** 打开；opener 是触发它的按钮（或取按钮的函数），关闭后焦点还给它 */
  public open(opener: SheetOpener = null): void {
    if (this.opened) {
      return;
    }
    this.opened = true;
    this.opener = opener;
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.layer.hidden = false;
    this.body.scrollTop = 0;
    // 先让“关着”的状态生效一帧，过渡才会播放
    void this.layer.offsetWidth;
    this.layer.classList.add('is-open');
    this.options.onOpenChange?.(true);
    this.focusInitial();
  }

  /** 对话框把焦点放在标了 data-autofocus 的按钮上（确认框是“取消”），面板放在自身 */
  private focusInitial(): void {
    const preferred = this.panel.querySelector<HTMLElement>('[data-autofocus]');
    (preferred ?? this.panel).focus({ preventScroll: true });
  }

  public close(restoreFocus: boolean = true): void {
    if (!this.opened) {
      return;
    }
    this.opened = false;
    this.layer.classList.remove('is-open');
    const finish = (): void => {
      this.hideTimer = null;
      this.layer.hidden = true;
    };
    if (this.options.reducedMotion) {
      finish();
    } else {
      this.hideTimer = setTimeout(finish, CLOSE_MS);
    }
    this.options.onOpenChange?.(false);
    const opener = this.opener;
    this.opener = null;
    const target = typeof opener === 'function' ? opener() : opener;
    if (restoreFocus && target?.isConnected) {
      target.focus({ preventScroll: true });
    }
  }

  /**
   * 面板打开时的按键：Tab 在面板内循环；上下方向键在各设置行之间移动焦点
   * （左右方向键留给行内控件自己调整数值）。返回 true 表示已处理。
   */
  public handleKeydown(event: KeyboardEvent): boolean {
    if (!this.opened) {
      return false;
    }
    if (event.key === 'Tab') {
      const tabbable = getTabbable(this.panel);
      if (tabbable.length === 0) {
        event.preventDefault();
        return true;
      }
      const active = document.activeElement;
      const index = active instanceof HTMLElement ? tabbable.indexOf(active) : -1;
      const last = tabbable.length - 1;
      if (event.shiftKey && index <= 0) {
        event.preventDefault();
        tabbable[last].focus();
      } else if (!event.shiftKey && (index === last || index === -1)) {
        event.preventDefault();
        tabbable[0].focus();
      }
      return true;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const moved = this.moveRowFocus(event.key === 'ArrowDown' ? 1 : -1);
      if (moved) {
        event.preventDefault();
      }
      return moved;
    }
    return false;
  }

  /** 把焦点移到下一行 / 上一行的第一个控件（同一行里的多个按钮算一站） */
  private moveRowFocus(direction: 1 | -1): boolean {
    const tabbable = getTabbable(this.panel);
    if (tabbable.length === 0) {
      return false;
    }
    const active = document.activeElement;
    const index = active instanceof HTMLElement ? tabbable.indexOf(active) : -1;
    if (index === -1) {
      tabbable[direction === 1 ? 0 : tabbable.length - 1].focus();
      return true;
    }
    const rowOf = (node: HTMLElement): Element | HTMLElement =>
      node.closest('[data-nav-row]') ?? node;
    const currentRow = rowOf(tabbable[index]);
    let cursor = index + direction;
    while (cursor >= 0 && cursor < tabbable.length && rowOf(tabbable[cursor]) === currentRow) {
      cursor += direction;
    }
    if (cursor < 0 || cursor >= tabbable.length) {
      return false;
    }
    // 向上移动时落在那一行的第一个控件上
    const targetRow = rowOf(tabbable[cursor]);
    while (cursor > 0 && rowOf(tabbable[cursor - 1]) === targetRow) {
      cursor--;
    }
    tabbable[cursor].focus();
    return true;
  }

  public dispose(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.opened = false;
    this.opener = null;
    this.layer.remove();
  }
}
