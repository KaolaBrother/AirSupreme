/**
 * 主菜单各模块共用的 DOM 小工具（不依赖 three）。
 */

/** 创建元素并可选地写入类名与文字（文字一律走 textContent） */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

/** 内联 SVG 图标（常量字符串，装饰用，读屏忽略） */
export function icon(svg: string, className: string = 'mi'): HTMLSpanElement {
  const node = document.createElement('span');
  node.className = className;
  node.setAttribute('aria-hidden', 'true');
  node.innerHTML = svg;
  return node;
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  '[role="radio"][tabindex="0"]',
  '[tabindex="0"]',
].join(',');

/** root 内当前可以用 Tab 到达的元素（按文档顺序；跳过隐藏 / inert 的子树） */
export function getTabbable(root: HTMLElement): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  const result: HTMLElement[] = [];
  for (const node of Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))) {
    if (seen.has(node) || node.tabIndex < 0) {
      continue;
    }
    if (node.closest('[hidden], [inert]')) {
      continue;
    }
    seen.add(node);
    result.push(node);
  }
  return result;
}

/** 键盘事件是否来自需要自己处理方向键 / 回车的控件 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}
