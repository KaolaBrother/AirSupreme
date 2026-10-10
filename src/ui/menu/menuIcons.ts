/**
 * 主菜单 / 机库用的内联 SVG 图标（24×24，描边取 currentColor）。全部在代码里生成，不引入图片资源。
 */

function stroke(body: string): string {
  return (
    '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" focusable="false">' +
    `${body}</svg>`
  );
}

export const MENU_ICONS = {
  /** 继续：实心三角 */
  play: stroke('<path d="M8 5.2v13.6L19 12z" fill="currentColor" stroke="none"/>'),
  /** 新战役：航路点菱形 + 加号 */
  campaign: stroke('<path d="M12 2.8l9.2 9.2-9.2 9.2L2.8 12z"/><path d="M12 8.6v6.8M8.6 12h6.8"/>'),
  /** 机库：拱顶 + 库门 */
  hangar: stroke('<path d="M2.8 20V11.4L12 5l9.2 6.4V20"/><path d="M7 20v-6.4h10V20M7 16.8h10"/>'),
  /** 设置：三条推子 */
  settings: stroke(
    '<path d="M3.5 7h9.2M17.3 7h3.2M3.5 12h2.9M11 12h9.5M3.5 17h10.7M18.8 17h1.7"/>' +
      '<circle cx="15" cy="7" r="2.3"/><circle cx="8.7" cy="12" r="2.3"/>' +
      '<circle cx="16.5" cy="17" r="2.3"/>'
  ),
  /** 操作说明：手册 */
  manual: stroke(
    '<path d="M5 4.2h10.4A2.6 2.6 0 0118 6.8V20H7.6A2.6 2.6 0 015 17.4z"/>' +
      '<path d="M5 17.4a2.6 2.6 0 012.6-2.6H18M9 8.4h5.4"/>'
  ),
  chevronRight: stroke('<path d="M9 5.5l6.5 6.5L9 18.5"/>'),
  chevronLeft: stroke('<path d="M15 5.5L8.5 12l6.5 6.5"/>'),
  chevronDown: stroke('<path d="M5.5 9l6.5 6.5L18.5 9"/>'),
  close: stroke('<path d="M6 6l12 12M18 6L6 18"/>'),
  minus: stroke('<path d="M6 12h12"/>'),
  plus: stroke('<path d="M6 12h12M12 6v12"/>'),
  warning: stroke('<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.4M12 17.2v.2"/>'),
  keyboard: stroke(
    '<rect x="2.8" y="6" width="18.4" height="12" rx="2"/>' +
      '<path d="M6.5 10h.2M10 10h.2M13.8 10h.2M17.3 10h.2M7.5 14h9"/>'
  ),
  touch: stroke(
    '<path d="M9 11.5V5.6a1.7 1.7 0 013.4 0v5"/>' +
      '<path d="M12.4 10.2a1.6 1.6 0 013.2 0v1.2a1.6 1.6 0 013.1.5v3.6a5.5 5.5 0 01-5.5 5.5h-1' +
      'a5.4 5.4 0 01-4.5-2.4l-2.6-4a1.6 1.6 0 012.6-1.9L9 14"/>'
  ),
  rotate: stroke('<path d="M19.5 12a7.5 7.5 0 11-2.4-5.5"/><path d="M19.6 4.2v3.6H16"/>'),
  /** 升级：两道向上的折线 */
  upgrade: stroke('<path d="M5.5 12.5L12 6l6.5 6.5M5.5 18.5L12 12l6.5 6.5"/>'),
  /** 退出：门框 + 向外的箭头 */
  exit: stroke('<path d="M13.5 4.5H5.5v15h8"/><path d="M10 12h10.5M16.8 8.2l3.8 3.8-3.8 3.8"/>'),
} as const;

export type MenuIconName = keyof typeof MENU_ICONS;
