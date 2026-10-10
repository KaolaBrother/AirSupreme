/**
 * 面板样式：面板容器（设置 / 操作说明从左侧滑入，竖屏时从底部升起；确认框居中）、
 * 设置控件（步进器 / 分段选择 / 音量格条 / 开关 / 高级折叠）、操作说明（按键表 / 触屏示意图）。
 * 颜色与字体变量在 menuStyles.ts 的 #start-menu 上定义。
 */

/** 共用片段（暂停菜单也用）：小标签 + 大标题 */
const HEADING_CSS = `
#start-menu .ms-kicker {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--tm-ice);
}

#start-menu .ms-kicker::before {
  content: '';
  flex: none;
  width: 16px;
  height: 2px;
  background: var(--tm-ice);
}

#start-menu .ms-title {
  margin: 7px 0 0;
  font-family: var(--tm-display);
  font-stretch: 115%;
  font-size: 28px;
  font-weight: 900;
  line-height: 1.05;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #f4fbff;
}

#start-menu .ms-title:lang(zh) {
  letter-spacing: 0.18em;
}
`;

/** 共用片段：确认框的说明文字、存档卡片与按钮 */
const CONFIRM_CSS = `
#start-menu .cf-text {
  margin: 0;
  font-size: 15px;
  line-height: 1.55;
  color: var(--tm-muted);
}

#start-menu .cf-save {
  margin: 14px 0 0;
  padding: 12px 14px;
  border: 1px solid rgba(255, 179, 71, 0.4);
  border-left: 3px solid var(--tm-amber);
  background: rgba(255, 179, 71, 0.07);
}

#start-menu .cf-save-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--tm-amber);
}

#start-menu .cf-save-title {
  display: block;
  margin-top: 6px;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.35;
  color: #ffffff;
}

#start-menu .cf-save-meta {
  display: block;
  margin-top: 3px;
  font-size: 13px;
  color: var(--tm-muted);
}

#start-menu .cf-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

#start-menu .cf-btn {
  flex: 1 1 150px;
  min-height: 48px;
  padding: 0 12px;
  border: 1px solid rgba(143, 228, 255, 0.42);
  border-radius: 3px;
  background: rgba(143, 228, 255, 0.07);
  color: var(--tm-text);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease, transform 0.12s ease;
}

#start-menu .cf-btn:active {
  transform: scale(0.97);
  background: rgba(143, 228, 255, 0.24);
}

/* 不丢东西的主操作（暂停菜单的“保存并退出”）：与标题画面主按钮同一块冰蓝 */
#start-menu .cf-btn-primary {
  border-color: #9fe8ff;
  background: linear-gradient(180deg, #dcf7ff 0%, #9fe8ff 46%, #72d0f1 100%);
  color: var(--tm-ink);
}

#start-menu .cf-btn-primary:active {
  background: #c4f0ff;
}

#start-menu .cf-btn-danger {
  border-color: var(--tm-amber);
  background: var(--tm-amber);
  color: #1d1002;
}

#start-menu .cf-btn-danger:active {
  background: #ffc978;
}

@media (hover: hover) {
  #start-menu .cf-btn:hover {
    background: rgba(143, 228, 255, 0.18);
    border-color: var(--tm-ice);
  }

  #start-menu .cf-btn-primary:hover {
    background: linear-gradient(180deg, #f1fcff 0%, #b9efff 46%, #8ddcf7 100%);
    border-color: #ffffff;
  }

  #start-menu .cf-btn-danger:hover {
    background: #ffc670;
    border-color: #ffc670;
  }
}
`;

/** 共用片段：设置行与步进器 */
const SETTING_ROW_CSS = `
#start-menu .st-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px 18px;
  min-height: 62px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(143, 228, 255, 0.1);
}

#start-menu .st-row-text {
  flex: 1 1 130px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

#start-menu .st-label {
  font-size: 15.5px;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: var(--tm-text);
}

#start-menu .st-caption {
  font-size: 12.5px;
  font-weight: 400;
  line-height: 1.35;
  letter-spacing: 0;
  text-transform: none;
  color: rgba(183, 231, 255, 0.66);
}

#start-menu .st-row-control {
  flex: none;
  display: flex;
  justify-content: flex-end;
  min-width: 0;
}

#start-menu .st-row[data-wide] .st-row-control {
  flex: 0 1 330px;
}

/* ---------------------------------------------------------------- 步进器 */
#start-menu .st-stepper {
  display: flex;
  align-items: center;
  gap: 6px;
}

#start-menu .st-step {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border: 1px solid rgba(143, 228, 255, 0.36);
  border-radius: 3px;
  background: rgba(143, 228, 255, 0.07);
  color: var(--tm-ice);
  cursor: pointer;
  transition: background 0.14s ease, border-color 0.14s ease, transform 0.1s ease;
}

/* 加减号：按钮文字是 + / -（字号 0，不显示），图形用两条细杠画 */
#start-menu .st-step {
  position: relative;
  font-size: 0;
}

#start-menu .st-step::before,
#start-menu .st-step::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 16px;
  height: 2px;
  margin: -1px 0 0 -8px;
  border-radius: 1px;
  background: currentColor;
}

#start-menu .st-step::after {
  transform: rotate(90deg);
}

#start-menu .st-step[data-step='-1']::after {
  display: none;
}

#start-menu .st-step:active {
  transform: scale(0.92);
  background: rgba(143, 228, 255, 0.3);
  border-color: var(--tm-ice);
}

#start-menu .st-step[aria-disabled='true'] {
  opacity: 0.3;
  cursor: default;
}

#start-menu .st-step[aria-disabled='true']:active {
  transform: none;
  background: rgba(143, 228, 255, 0.07);
}

#start-menu .st-readout {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 104px;
  padding: 0 4px;
}

#start-menu .st-value {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #ffffff;
  white-space: nowrap;
}

#start-menu .st-pips {
  display: flex;
  gap: 3px;
}

#start-menu .st-pip {
  width: 9px;
  height: 4px;
  background: rgba(143, 228, 255, 0.2);
  transition: background 0.14s ease;
}

#start-menu .st-pip.is-on {
  background: var(--tm-ice);
  box-shadow: 0 0 6px rgba(143, 228, 255, 0.6);
}
`;

/**
 * 面板之外也用的部分（选择器仍以 #start-menu 开头，换容器见 menuStyles.ts 的 rescopeMenuCss）：
 * 标题、确认框内容、设置行与步进器。
 */
export function sheetKitCss(): string {
  return HEADING_CSS + CONFIRM_CSS + SETTING_ROW_CSS;
}

export const SHEET_CSS = `
/* ================================================================ 面板容器 */
#start-menu .ms-layer {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  justify-content: flex-start;
  align-items: stretch;
}

#start-menu .ms-layer[hidden] {
  display: none;
}

/* 关闭动画播放期间不拦截点击：收起面板后可以立刻点标题画面上的按钮 */
#start-menu .ms-layer:not(.is-open) {
  pointer-events: none;
}

#start-menu .ms-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(2, 6, 13, 0.7) 0%, rgba(2, 6, 13, 0.42) 100%);
  opacity: 0;
  transition: opacity 0.24s ease;
}

#start-menu .ms-layer.is-open .ms-scrim {
  opacity: 1;
}

#start-menu .ms-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(600px, 100%);
  height: 100%;
  padding-left: env(safe-area-inset-left);
  background: var(--tm-panel);
  border-right: 1px solid rgba(143, 228, 255, 0.3);
  box-shadow: 30px 0 70px rgba(0, 0, 0, 0.55);
  outline: none;
  opacity: 0;
  transform: translate3d(-36px, 0, 0);
  transition: transform 0.26s var(--tm-ease), opacity 0.2s ease;
}

#start-menu .ms-layer.is-open .ms-panel {
  opacity: 1;
  transform: none;
}

/* 面板右上角的切角亮线 */
#start-menu .ms-panel::after {
  content: '';
  position: absolute;
  right: -1px;
  top: 0;
  width: 2px;
  height: 96px;
  background: linear-gradient(180deg, var(--tm-ice), rgba(143, 228, 255, 0));
  pointer-events: none;
}

#start-menu .ms-head {
  flex: none;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: max(22px, env(safe-area-inset-top)) 22px 14px 28px;
  border-bottom: 1px solid rgba(143, 228, 255, 0.16);
}

#start-menu .ms-heading {
  min-width: 0;
}

${HEADING_CSS}

#start-menu .ms-close {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border: 1px solid rgba(143, 228, 255, 0.34);
  border-radius: 3px;
  background: rgba(143, 228, 255, 0.06);
  color: var(--tm-text);
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease, transform 0.12s ease;
}

#start-menu .ms-close:active {
  transform: scale(0.94);
  background: rgba(143, 228, 255, 0.26);
}

#start-menu .ms-body {
  flex: 1;
  min-height: 0;
  padding: 6px 22px 28px 28px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  scrollbar-width: thin;
  scrollbar-color: rgba(143, 228, 255, 0.35) transparent;
}

#start-menu .ms-body::after {
  content: '';
  display: block;
  height: env(safe-area-inset-bottom);
}

#start-menu .ms-foot {
  flex: none;
  padding: 14px 22px max(18px, env(safe-area-inset-bottom)) 28px;
  border-top: 1px solid rgba(143, 228, 255, 0.16);
}

#start-menu .ms-foot:empty {
  display: none;
}

@media (hover: hover) {
  #start-menu .ms-close:hover {
    background: rgba(143, 228, 255, 0.18);
    border-color: var(--tm-ice);
  }
}

/* ---------------------------------------------------------------- 确认框 */
#start-menu .ms-layer[data-variant='dialog'] {
  z-index: 6;
  justify-content: center;
  align-items: center;
  padding:
    max(16px, env(safe-area-inset-top))
    max(16px, env(safe-area-inset-right))
    max(16px, env(safe-area-inset-bottom))
    max(16px, env(safe-area-inset-left));
}

#start-menu .ms-layer[data-variant='dialog'] .ms-scrim {
  background: rgba(2, 6, 13, 0.74);
}

#start-menu .ms-layer[data-variant='dialog'] .ms-panel {
  width: min(520px, 100%);
  height: auto;
  max-height: 100%;
  padding-left: 0;
  border: 1px solid rgba(143, 228, 255, 0.36);
  border-top: 2px solid var(--tm-amber);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.65);
  transform: translate3d(0, 14px, 0) scale(0.97);
}

#start-menu .ms-layer[data-variant='dialog'].is-open .ms-panel {
  transform: none;
}

#start-menu .ms-layer[data-variant='dialog'] .ms-panel::after {
  display: none;
}

#start-menu .ms-layer[data-variant='dialog'] .ms-head {
  padding: 20px 18px 12px 24px;
}

#start-menu .ms-layer[data-variant='dialog'] .ms-kicker {
  color: var(--tm-amber);
}

#start-menu .ms-layer[data-variant='dialog'] .ms-kicker::before {
  background: var(--tm-amber);
}

#start-menu .ms-layer[data-variant='dialog'] .ms-title {
  font-size: 23px;
}

#start-menu .ms-layer[data-variant='dialog'] .ms-body {
  padding: 16px 24px 18px;
}

#start-menu .ms-layer[data-variant='dialog'] .ms-foot {
  padding: 14px 24px 20px;
}

${CONFIRM_CSS}

/* ================================================================ 设置 */
#start-menu .st-group {
  margin-top: 20px;
}

#start-menu .st-group-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 2px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--tm-ice);
}

#start-menu .st-group-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(143, 228, 255, 0.4), rgba(143, 228, 255, 0));
}

${SETTING_ROW_CSS}

/* ---------------------------------------------------------------- 分段选择 */
#start-menu .st-seg {
  display: grid;
  grid-template-columns: repeat(var(--st-seg-count, 2), minmax(0, 1fr));
  gap: 3px;
  width: 100%;
  padding: 3px;
  border: 1px solid rgba(143, 228, 255, 0.26);
  border-radius: 4px;
  background: rgba(2, 8, 16, 0.6);
}

#start-menu .st-seg-opt {
  min-width: 0;
  min-height: 44px;
  padding: 4px 4px;
  border: 0;
  border-radius: 2px;
  background: none;
  color: rgba(214, 240, 255, 0.82);
  font-size: 13.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.15;
  cursor: pointer;
  overflow-wrap: anywhere;
  transition: background 0.16s ease, color 0.16s ease;
}

/* 四个及以上选项：收紧字号与内边距，最长的词（Performance）也不折行 */
#start-menu .st-seg[data-dense] .st-seg-opt {
  padding: 4px 1px;
  font-size: 12px;
  letter-spacing: 0;
}

#start-menu .st-seg-opt:active {
  background: rgba(143, 228, 255, 0.2);
}

#start-menu .st-seg-opt[aria-checked='true'] {
  background: linear-gradient(180deg, #c9f3ff 0%, #86dbf8 100%);
  color: var(--tm-ink);
  box-shadow: 0 0 14px rgba(143, 228, 255, 0.35);
}

@media (hover: hover) {
  #start-menu .st-step:hover:not([aria-disabled='true']) {
    background: rgba(143, 228, 255, 0.2);
    border-color: var(--tm-ice);
  }

  #start-menu .st-seg-opt:hover:not([aria-checked='true']) {
    background: rgba(143, 228, 255, 0.13);
    color: #ffffff;
  }
}

/* ---------------------------------------------------------------- 音量格条 */
#start-menu .st-meter {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}

#start-menu .st-meter-track {
  position: relative;
  flex: 1;
  min-width: 96px;
  height: 46px;
  cursor: pointer;
  touch-action: pan-y;
}

#start-menu .st-meter-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  pointer-events: none;
}

#start-menu .st-meter-cells {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  gap: 3px;
  padding: 11px 2px;
  border-radius: 3px;
}

/* 格子由低到高，像一条上扬的音量条 */
#start-menu .st-cell {
  flex: 1;
  height: calc(34% + var(--st-cell, 0) * 7.3%);
  background: rgba(143, 228, 255, 0.17);
  transition: background 0.12s ease;
}

#start-menu .st-cell.is-on {
  background: var(--tm-ice);
  box-shadow: 0 0 7px rgba(143, 228, 255, 0.5);
}

#start-menu .st-meter-track:focus-within .st-meter-cells {
  outline: 2px solid #ffffff;
  outline-offset: 1px;
}

#start-menu .st-value-num {
  flex: none;
  width: 46px;
  text-align: right;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

/* ---------------------------------------------------------------- 开关 */
#start-menu .st-switch {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  min-height: 46px;
  padding: 0 2px 0 10px;
  border: 0;
  background: none;
  color: var(--tm-text);
  cursor: pointer;
}

#start-menu .st-switch-text {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: rgba(214, 240, 255, 0.82);
}

#start-menu .st-switch-track {
  position: relative;
  flex: none;
  width: 56px;
  height: 30px;
  border: 1px solid rgba(143, 228, 255, 0.4);
  border-radius: 15px;
  background: rgba(2, 8, 16, 0.6);
  transition: background 0.18s ease, border-color 0.18s ease;
}

#start-menu .st-switch-knob {
  position: absolute;
  left: 3px;
  top: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(183, 231, 255, 0.7);
  transition: transform 0.18s var(--tm-ease), background 0.18s ease;
}

#start-menu .st-switch[aria-checked='true'] .st-switch-track {
  border-color: var(--tm-ice);
  background: rgba(143, 228, 255, 0.34);
}

#start-menu .st-switch[aria-checked='true'] .st-switch-knob {
  background: #ffffff;
  box-shadow: 0 0 10px rgba(143, 228, 255, 0.8);
  transform: translate3d(26px, 0, 0);
}

#start-menu .st-switch[aria-checked='true'] .st-switch-text {
  color: #ffffff;
}

/* ---------------------------------------------------------------- 高级 */
#start-menu .st-advanced {
  margin-top: 24px;
  border: 1px solid rgba(143, 228, 255, 0.18);
  border-radius: 4px;
  background: rgba(2, 8, 16, 0.42);
}

#start-menu .st-advanced-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 62px;
  padding: 8px 12px 8px 14px;
  border: 0;
  background: none;
  color: var(--tm-text);
  text-align: left;
  cursor: pointer;
}

#start-menu .st-advanced-titles {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

#start-menu .st-advanced-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--tm-ice);
}

#start-menu .st-badge {
  flex: none;
  padding: 3px 8px;
  border: 1px solid rgba(255, 179, 71, 0.6);
  border-radius: 2px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--tm-amber);
  white-space: nowrap;
}

#start-menu .st-badge[hidden] {
  display: none;
}

#start-menu .st-advanced-chevron {
  font-size: 20px;
  color: var(--tm-ice);
  transition: transform 0.24s var(--tm-ease);
}

#start-menu .st-advanced.is-open .st-advanced-chevron {
  transform: rotate(180deg);
}

#start-menu .st-advanced-content {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.26s var(--tm-ease);
}

#start-menu .st-advanced.is-open .st-advanced-content {
  grid-template-rows: 1fr;
}

#start-menu .st-advanced-inner {
  min-height: 0;
  padding: 0 14px;
  overflow: hidden;
  visibility: hidden;
  transition: visibility 0s linear 0.26s;
}

#start-menu .st-advanced.is-open .st-advanced-inner {
  visibility: visible;
  transition-delay: 0s;
}

#start-menu .st-advanced-inner .st-row:last-child {
  border-bottom: 0;
}

/* ================================================================ 操作说明 */
/* 页签栏在面板标题与正文之间（不在滚动区里）；左右边距与正文的内边距对齐 */
#start-menu .hp-tabs {
  flex: none;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 3px;
  margin: 12px 22px 8px 28px;
  padding: 3px;
  border: 1px solid rgba(143, 228, 255, 0.26);
  border-radius: 4px;
  background: rgba(2, 8, 16, 0.6);
}

#start-menu .hp-tab {
  min-height: 44px;
  border: 0;
  border-radius: 2px;
  background: none;
  color: rgba(214, 240, 255, 0.82);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.16s ease, color 0.16s ease;
}

#start-menu .hp-tab[aria-selected='true'] {
  background: linear-gradient(180deg, #c9f3ff 0%, #86dbf8 100%);
  color: var(--tm-ink);
  box-shadow: 0 0 14px rgba(143, 228, 255, 0.35);
}

@media (hover: hover) {
  #start-menu .hp-tab:hover:not([aria-selected='true']) {
    background: rgba(143, 228, 255, 0.13);
    color: #ffffff;
  }
}

#start-menu .hp-panel[hidden] {
  display: none;
}

#start-menu .hp-group {
  margin-top: 20px;
}

#start-menu .hp-keys {
  margin: 0;
}

#start-menu .hp-row {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 48px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(143, 228, 255, 0.1);
}

/*
 * 列宽按最宽的一组键帽定（L Shift / L Ctrl 约 132px，留一点余量）。键帽不收缩（文字不会被挤到边框上），
 * 一行放不下时换行——窄面板上这一列只有 104px，两个长键帽上下排
 */
#start-menu .hp-row-keys {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  width: 142px;
}

#start-menu .hp-key {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 32px;
  padding: 0 9px;
  border: 1px solid rgba(143, 228, 255, 0.5);
  border-bottom-width: 3px;
  border-radius: 5px;
  background: rgba(143, 228, 255, 0.08);
  font-family: var(--tm-font);
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
}

#start-menu .hp-joiner {
  font-size: 12px;
  color: rgba(183, 231, 255, 0.6);
  white-space: pre;
}

#start-menu .hp-row-action {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 15px;
  line-height: 1.35;
  color: var(--tm-text);
}

#start-menu .hp-note {
  margin: 0;
  padding: 9px 12px;
  border-left: 3px solid var(--tm-green);
  background: rgba(92, 255, 176, 0.07);
  font-size: 13px;
  line-height: 1.5;
  color: rgba(214, 255, 236, 0.9);
}

#start-menu .hp-text {
  margin: 10px 0 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--tm-text);
}

#start-menu .hp-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 68px;
  height: 32px;
  padding: 0 10px;
  border: 2px solid var(--hp-chip, var(--tm-ice));
  border-radius: 16px;
  background: rgba(2, 8, 16, 0.6);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #ffffff;
  white-space: nowrap;
}

#start-menu .hp-figure {
  margin: 16px 0 0;
}

#start-menu .hp-diagram {
  display: block;
  width: 100%;
  height: auto;
}

#start-menu .hp-figcaption {
  margin-top: 8px;
  font-size: 13px;
  letter-spacing: 0.04em;
  text-align: center;
  color: var(--tm-muted);
}

#start-menu .hp-d-frame {
  fill: rgba(2, 8, 16, 0.66);
  stroke: rgba(143, 228, 255, 0.5);
  stroke-width: 1.5;
}

#start-menu .hp-d-zone {
  fill: rgba(143, 228, 255, 0.06);
  stroke: rgba(143, 228, 255, 0.45);
  stroke-width: 1;
  stroke-dasharray: 5 5;
}

#start-menu .hp-d-stick {
  fill: rgba(143, 228, 255, 0.08);
  stroke: rgba(143, 228, 255, 0.7);
  stroke-width: 1.5;
}

#start-menu .hp-d-knob {
  fill: rgba(143, 228, 255, 0.55);
  stroke: #ffffff;
  stroke-width: 1;
}

#start-menu .hp-d-radar {
  fill: rgba(92, 255, 176, 0.07);
  stroke: rgba(92, 255, 176, 0.75);
  stroke-width: 1.5;
}

#start-menu .hp-d-radar-ring {
  fill: none;
  stroke: rgba(92, 255, 176, 0.4);
  stroke-width: 1;
}

#start-menu .hp-d-label {
  fill: rgba(214, 244, 255, 0.86);
  font-family: var(--tm-font);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

#start-menu .hp-d-button {
  fill: rgba(2, 8, 16, 0.7);
  stroke-width: 2;
}

#start-menu .hp-d-button-label {
  fill: #ffffff;
  font-family: var(--tm-font);
  font-size: 9px;
  font-weight: 700;
}

/* ================================================================ 竖屏：面板从底部升起 */
@media (max-aspect-ratio: 1/1) {
  #start-menu .ms-layer {
    justify-content: center;
    align-items: flex-end;
  }

  #start-menu .ms-scrim {
    background: linear-gradient(180deg, rgba(2, 6, 13, 0.5) 0%, rgba(2, 6, 13, 0.74) 100%);
  }

  #start-menu .ms-layer[data-variant='panel'] .ms-panel {
    width: min(720px, 100%);
    height: auto;
    max-height: calc(100% - max(44px, env(safe-area-inset-top)));
    padding-left: 0;
    border: 1px solid rgba(143, 228, 255, 0.3);
    border-bottom: 0;
    border-top: 2px solid var(--tm-ice);
    box-shadow: 0 -24px 70px rgba(0, 0, 0, 0.6);
    transform: translate3d(0, 44px, 0);
  }

  #start-menu .ms-layer[data-variant='panel'].is-open .ms-panel {
    transform: none;
  }

  #start-menu .ms-layer[data-variant='panel'] .ms-panel::after {
    display: none;
  }

  #start-menu .ms-layer[data-variant='panel'] .ms-head {
    padding: 18px 16px 12px 20px;
  }

  #start-menu .ms-layer[data-variant='panel'] .ms-body {
    padding: 4px 16px 22px 20px;
  }

  #start-menu .hp-tabs {
    margin: 10px 16px 8px 20px;
  }

  #start-menu .ms-title {
    font-size: 24px;
  }
}

/* 窄面板：较宽的控件换到标签下面，占满一行 */
@media (max-width: 520px) {
  #start-menu .st-row[data-wide] {
    flex-wrap: wrap;
  }

  #start-menu .st-row[data-wide] .st-row-text {
    flex-basis: 100%;
  }

  #start-menu .st-row[data-wide] .st-row-control {
    flex: 1 1 100%;
  }

  #start-menu .st-readout {
    min-width: 88px;
  }

  #start-menu .hp-row-keys {
    width: 104px;
  }
}

/* 矮横屏：标题区压扁，正文多留一点高度 */
@media (orientation: landscape) and (max-height: 520px) {
  #start-menu .ms-head {
    align-items: center;
    padding-top: max(10px, env(safe-area-inset-top));
    padding-bottom: 8px;
  }

  #start-menu .ms-kicker {
    display: none;
  }

  #start-menu .ms-title {
    margin-top: 0;
    font-size: 20px;
  }

  #start-menu .ms-close {
    width: 44px;
    height: 44px;
  }

  #start-menu .st-group,
  #start-menu .hp-group {
    margin-top: 14px;
  }

  #start-menu .hp-tabs {
    margin-top: 8px;
    margin-bottom: 4px;
  }

  #start-menu .st-row {
    min-height: 56px;
    padding: 5px 0;
  }

  #start-menu .ms-layer[data-variant='dialog'] .ms-head {
    padding-top: 12px;
    padding-bottom: 8px;
  }

  #start-menu .ms-layer[data-variant='dialog'] .ms-body {
    padding-top: 10px;
    padding-bottom: 10px;
  }

  #start-menu .ms-layer[data-variant='dialog'] .ms-foot {
    padding-top: 10px;
    padding-bottom: 12px;
  }
}
`;
