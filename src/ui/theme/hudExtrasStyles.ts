import { HUD_COLORS } from './hudPalette';

/**
 * HUD 新增元件样式：顶部布局（驾驶舱信息栏 / 右上状态列 / 中央消息栈 / 中央播报）、
 * 挂载物面板（特殊武器 + 热焰弹）、自动存档提示、视角标签、Boss 阶段条、
 * 导弹告警 / 闪烁告警、屏幕边缘告警，以及第一人称下的仪表板风格。
 *
 * 显隐由 HUD 以内联 display 控制（便于测试与避免重排）；这里只负责外观与按布局密度定位。
 *
 * 顶部布局（#hud 已让出安全区，坐标相对安全区）：
 * - 左上信息栏、右上状态列各占一角；中央消息栈（Boss 阶段条 / 简报 / 事件目标 / 竖屏存档提示）
 *   纵向排布，桌面与横屏夹在两侧之间，竖屏排在两侧下方整行。
 * - 中央播报锚定在准星搜索环上方（环半径：桌面 11vmin，竖屏 min(8vmin, 80px)，
 *   与 LockOnIndicator 一致），向上生长，永不压住准星；横屏高度最紧，接在消息栈下方。
 */
export const HUD_EXTRAS_STYLE_ID = 'hud-extras-style';

const HUD_EXTRAS_CSS = `
/* ------------------------------------------------------------ 左上驾驶舱信息栏 */
#hud .hud-cabin {
  top: 18px;
  left: 20px;
  gap: 10px;
}

#hud .hud-cabin-primary {
  gap: 10px;
}

#hud-score {
  font-size: 19px;
  min-height: 60px;
  padding: 12px 14px;
}

#hud-speed {
  font-size: 16px;
  min-height: 60px;
  padding: 12px;
}

#hud-upgrades {
  font-size: 14px;
  padding: 8px 12px;
}

#hud:not([data-layout-density='desktop']) .hud-cabin {
  top: 10px;
  left: 10px;
  gap: 8px;
}

#hud:not([data-layout-density='desktop']) .hud-cabin-primary {
  gap: 8px;
}

#hud:not([data-layout-density='desktop']) #hud-score {
  font-size: 16px;
  min-height: 44px;
  padding: 10px 12px;
}

#hud:not([data-layout-density='desktop']) #hud-speed {
  font-size: 14px;
  min-height: 44px;
  padding: 10px;
}

#hud:not([data-layout-density='desktop']) #hud-upgrades {
  font-size: 12px;
  padding: 6px 10px;
}

/* 竖屏：信息栏收紧，给下方整行的消息栈与无线电让出高度 */
#hud[data-layout-density='touch-portrait'] .hud-cabin,
#hud[data-layout-density='touch-portrait'] .hud-cabin-primary {
  gap: 6px;
}

#hud[data-layout-density='touch-portrait'] #hud-score {
  font-size: 15px;
  min-height: 36px;
  padding: 7px 11px;
}

#hud[data-layout-density='touch-portrait'] #hud-speed {
  font-size: 13px;
  min-height: 36px;
  padding: 7px 10px;
}

#hud[data-layout-density='touch-portrait'] #hud-upgrades {
  font-size: 11px;
  padding: 5px 9px;
}

/* ------------------------------------------------------------ 右上状态列（敌机计数 / 生命 / 导弹 / 补给 / 道具） */
#hud-status {
  position: absolute;
  top: 66px;
  right: 20px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  pointer-events: none;
}

/* 横屏：血条居中，右上角空着，状态列贴顶，避免压到右侧按键簇最上方的暂停 / 视角键 */
#hud[data-layout-density='touch-landscape'] #hud-status {
  top: 10px;
  right: 10px;
  gap: 5px;
}

/* 竖屏：血条在右上角，状态列排在血条下方 */
#hud[data-layout-density='touch-portrait'] #hud-status {
  top: 38px;
  right: 10px;
  gap: 5px;
}

/* 与驾驶舱信息栏同款的深色胶囊：亮云层 / 雪地上也清晰 */
.hud-chip {
  box-sizing: border-box;
  padding: 5px 11px;
  border-radius: 11px;
  background: linear-gradient(160deg, rgba(18, 30, 48, 0.86), rgba(10, 14, 22, 0.74));
  border: 1px solid rgba(118, 204, 255, 0.28);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 6px 14px rgba(0, 0, 0, 0.2);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.08em;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  text-shadow: none;
}

#hud-wave-line {
  color: var(--hud-text, ${HUD_COLORS.text});
}

.hud-chip-powerup {
  border-color: rgba(255, 228, 92, 0.4);
}

#hud:not([data-layout-density='desktop']) .hud-chip {
  padding: 4px 9px;
  border-radius: 10px;
  font-size: 12px;
}

#hud-status .hud-pip-row {
  padding: 3px 6px;
  border-radius: 7px;
  background: rgba(8, 14, 24, 0.5);
}

#hud-missile-reload {
  width: 120px;
}

#hud:not([data-layout-density='desktop']) #hud-missile-reload {
  width: 100px;
}

.hud-pip-group {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

#hud:not([data-layout-density='desktop']) .hud-pip-group {
  gap: 5px;
}

/* 竖屏：生命与导弹并排一行，状态列更矮，不压到下方整行的消息栈 */
#hud[data-layout-density='touch-portrait'] .hud-pip-group {
  flex-direction: row;
  align-items: center;
}

/* ------------------------------------------------------------ 中央消息栈（Boss 阶段条 / 简报 / 事件目标） */
#hud-top-stack {
  position: absolute;
  top: 70px;
  left: 0;
  right: 0;
  margin: 0 auto;
  width: min(80vw, 460px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

:root[data-hud-boss='on'] #hud[data-layout-density='desktop'] #hud-top-stack {
  top: 80px;
}

/* 横屏：夹在左侧信息栏与右侧状态列之间（两侧各让出 196px） */
#hud[data-layout-density='touch-landscape'] #hud-top-stack {
  top: 38px;
  width: min(80vw, 420px, calc(100% - 392px));
  gap: 6px;
}

:root[data-hud-boss='on'] #hud[data-layout-density='touch-landscape'] #hud-top-stack {
  top: 60px;
}

/* 竖屏：排在信息栏与状态列下方，整行；无线电面板跟在栈底（--hud-stack-bottom） */
#hud[data-layout-density='touch-portrait'] #hud-top-stack {
  top: 128px;
  left: 10px;
  right: 10px;
  width: auto;
  gap: 6px;
}

/* 简报显示期间（约 1.8 秒）目标卡让位，栈高不会伸进准星区域 */
#hud-top-stack[data-briefing='on'] #hud-objective {
  display: none !important;
}

#hud-briefing {
  padding: 12px 16px;
}

.hud-brief-kicker {
  font-size: 11px;
}

.hud-brief-title {
  font-size: 18px;
}

.hud-brief-line {
  font-size: 13px;
}

#hud:not([data-layout-density='desktop']) #hud-briefing {
  width: 100%;
  max-width: 100%;
  padding: 9px 12px;
}

#hud:not([data-layout-density='desktop']) .hud-brief-kicker {
  font-size: 10px;
}

#hud:not([data-layout-density='desktop']) .hud-brief-title {
  font-size: 16px;
}

#hud:not([data-layout-density='desktop']) .hud-brief-line {
  font-size: 12px;
}

/* 事件目标：标题与进度同一行，正文在下 */
#hud-objective {
  width: fit-content;
  min-width: min(280px, 100%);
  max-width: 100%;
  padding: 9px 16px 10px;
}

.hud-obj-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: center;
  gap: 3px 10px;
  margin-bottom: 4px;
}

.hud-obj-title {
  font-size: 12px;
}

.hud-obj-status {
  font-size: 11px;
  line-height: 1.5;
  padding: 0 6px;
  border: 1px solid currentColor;
  border-radius: 4px;
}

.hud-obj-text {
  font-size: 15px;
  line-height: 1.3;
}

#hud:not([data-layout-density='desktop']) #hud-objective {
  min-width: min(240px, 100%);
  padding: 7px 12px 8px;
}

#hud:not([data-layout-density='desktop']) .hud-obj-title {
  font-size: 11px;
}

#hud:not([data-layout-density='desktop']) .hud-obj-status {
  font-size: 10px;
}

#hud:not([data-layout-density='desktop']) .hud-obj-text {
  font-size: 13px;
}

#hud[data-layout-density='touch-portrait'] #hud-objective {
  width: 100%;
}

/* ------------------------------------------------------------ 中央播报（准星上方的横幅） */
#hud-callout {
  left: 50%;
  bottom: calc(50% + 11vmin + 14px);
  transform: translateX(-50%);
  width: max-content;
  max-width: min(60vw, 760px, calc(100vw - 600px));
  display: flex;
  justify-content: center;
}

/*
 * 横屏高度最紧：播报接在顶部消息栈（简报 / 事件目标）下方，夹在两侧信息栏之间，
 * 与目标卡永不重叠，且位于准星搜索环上方（栈底由 HUD 写入 --hud-stack-bottom）
 */
#hud-callout[data-layout-density='touch-landscape'] {
  left: calc(env(safe-area-inset-left, 0px) + 196px);
  right: calc(env(safe-area-inset-right, 0px) + 196px);
  top: calc(var(--hud-stack-bottom, 38px) + 6px);
  transform: none;
  width: auto;
  max-width: none;
}

#hud-callout[data-layout-density='touch-portrait'] {
  left: max(10px, env(safe-area-inset-left));
  right: max(10px, env(safe-area-inset-right));
  bottom: calc(50% + min(8vmin, 80px) + 12px);
  transform: none;
  width: auto;
  max-width: none;
}

.hud-callout-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  max-width: 100%;
  box-sizing: border-box;
  padding: 6px 30px 8px;
  background: linear-gradient(90deg, transparent, rgba(6, 12, 22, 0.62) 16%, rgba(6, 12, 22, 0.62) 84%, transparent);
  text-align: center;
}

.hud-callout-sub {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.22em;
  color: #ffffff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
}

.hud-callout-main {
  max-width: 100%;
  font-size: clamp(24px, 2.4vw, 38px);
  font-weight: 800;
  line-height: 1.18;
  text-wrap: balance;
  overflow-wrap: break-word;
}

.hud-callout-icon {
  margin-right: 0.35em;
  font-size: 0.95em;
}

#hud-callout[data-variant='announcement'] .hud-callout-text {
  color: #f3fbff;
  text-shadow: 0 0 14px rgba(120, 220, 255, 0.45), 0 2px 5px rgba(0, 0, 0, 0.95);
}

#hud-callout[data-variant='powerup'] .hud-callout-text {
  color: #ffe45c;
  text-shadow: 0 0 14px rgba(255, 215, 0, 0.55), 0 2px 5px rgba(0, 0, 0, 0.95);
}

#hud-callout:not([data-layout-density='desktop']) .hud-callout-card {
  padding: 5px 18px 6px;
}

#hud-callout:not([data-layout-density='desktop']) .hud-callout-sub {
  font-size: 11px;
}

#hud-callout:not([data-layout-density='desktop']) .hud-callout-main {
  font-size: 18px;
}

/* ------------------------------------------------------------ 挂载物面板（右下） */
#hud-stores {
  position: fixed;
  right: 20px;
  bottom: 20px;
  width: 228px;
  box-sizing: border-box;
  flex-direction: column;
  padding: 10px 12px 11px;
  background: var(--hud-glass, ${HUD_COLORS.glass});
  border: 1px solid var(--hud-edge, ${HUD_COLORS.edge});
  border-radius: 10px;
  box-shadow: var(--hud-shadow, ${HUD_COLORS.shadow});
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  font-variant-numeric: tabular-nums;
  text-shadow: none;
  pointer-events: none;
}

#hud[data-layout-density='touch-landscape'] #hud-stores,
#hud[data-layout-density='touch-portrait'] #hud-stores {
  right: max(10px, env(safe-area-inset-right));
  bottom: max(10px, env(safe-area-inset-bottom));
  width: 172px;
  padding: 8px 10px 9px;
}

#hud-stores[data-sections='both'] #hud-flares {
  margin-top: 9px;
  padding-top: 8px;
  border-top: 1px solid rgba(143, 228, 255, 0.16);
}

.hx-wp-head {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.hx-wp-code {
  flex: none;
  font-family: var(--hud-mono, monospace);
  font-size: 18px;
  font-weight: 900;
  letter-spacing: 0.08em;
  color: var(--hud-weapon, ${HUD_COLORS.weapon});
}

.hx-wp-icon {
  flex: none;
  font-size: 13px;
  line-height: 1;
}

.hx-wp-name {
  min-width: 0;
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--hud-text, ${HUD_COLORS.text});
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hx-wp-lamp {
  flex: none;
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--hud-muted, ${HUD_COLORS.muted});
}

.hx-wp-lamp::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(183, 231, 255, 0.25);
}

#hud-weapon-panel[data-ready='true'] .hx-wp-lamp {
  color: var(--hud-lock, ${HUD_COLORS.lock});
}

#hud-weapon-panel[data-ready='true'] .hx-wp-lamp::before {
  background: var(--hud-lock, ${HUD_COLORS.lock});
  box-shadow: 0 0 8px var(--hud-lock, ${HUD_COLORS.lock});
}

#hud-weapon-panel[data-overheated='true'] .hx-wp-lamp {
  color: var(--hud-threat, ${HUD_COLORS.threat});
}

#hud-weapon-panel[data-overheated='true'] .hx-wp-lamp::before {
  background: var(--hud-threat, ${HUD_COLORS.threat});
}

.hx-meter {
  position: relative;
  margin-top: 8px;
  height: 6px;
  overflow: hidden;
  border: 1px solid rgba(143, 228, 255, 0.25);
  border-radius: 1px;
  background: rgba(143, 228, 255, 0.1);
}

.hx-meter-fill {
  position: absolute;
  inset: 0;
  transform-origin: left center;
  transform: scaleX(0);
  background: var(--hud-weapon, ${HUD_COLORS.weapon});
  transition: transform 0.08s linear;
}

#hud-weapon-panel[data-mode='beam'] .hx-meter-fill {
  background: linear-gradient(90deg, ${HUD_COLORS.weapon}, ${HUD_COLORS.threat});
}

#hud-weapon-panel[data-mode='charge'] .hx-meter-fill {
  background: linear-gradient(90deg, ${HUD_COLORS.sys}, #ffffff);
}

#hud-weapon-panel[data-mode='pulse'] .hx-meter-fill {
  background: var(--hud-sys, ${HUD_COLORS.sys});
}

#hud-weapon-panel[data-overheated='true'] .hx-meter-fill {
  background: var(--hud-threat, ${HUD_COLORS.threat});
  animation: hx-blink 0.5s steps(2) infinite;
}

.hx-wp-sub {
  margin-top: 5px;
  min-height: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.hx-wp-ammo {
  display: flex;
  align-items: center;
  gap: 3px;
}

.hx-ammo-pips {
  display: flex;
  align-items: center;
  gap: 3px;
}

.hx-ammo-pip {
  --fill: 0%;
  width: 7px;
  height: 10px;
  box-sizing: border-box;
  border: 1px solid rgba(255, 179, 71, 0.6);
  border-radius: 1px;
  background: linear-gradient(to top, rgba(255, 179, 71, 0.45) var(--fill), transparent var(--fill));
}

.hx-ammo-pip.is-on {
  background: var(--hud-weapon, ${HUD_COLORS.weapon});
}

.hx-wp-ammo-text {
  margin-left: 3px;
  font-family: var(--hud-mono, monospace);
  font-size: 11px;
  color: var(--hud-weapon, ${HUD_COLORS.weapon});
}

.hx-wp-label {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--hud-muted, ${HUD_COLORS.muted});
  white-space: nowrap;
}

#hud-weapon-panel[data-overheated='true'] .hx-wp-label {
  color: var(--hud-threat, ${HUD_COLORS.threat});
  font-weight: 700;
}

.hx-slots {
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
}

.hx-slot {
  position: relative;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  box-sizing: border-box;
  border: 1px solid rgba(143, 228, 255, 0.24);
  border-radius: 2px;
  font-family: var(--hud-mono, monospace);
  font-size: 10px;
  color: rgba(183, 231, 255, 0.75);
}

.hx-slot-key {
  font-size: 9px;
  opacity: 0.6;
}

.hx-slot.is-selected {
  border-color: var(--hud-weapon, ${HUD_COLORS.weapon});
  background: var(--hud-weapon, ${HUD_COLORS.weapon});
  color: #1b1307;
  font-weight: 900;
}

.hx-slot.is-ready:not(.is-selected)::after {
  content: '';
  position: absolute;
  top: 2px;
  right: 2px;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--hud-lock, ${HUD_COLORS.lock});
}

.hx-slot.is-locked {
  border-style: dashed;
  color: rgba(183, 231, 255, 0.32);
}

.hx-slot-lock,
.hx-slot-lock svg {
  width: 10px;
  height: 10px;
}

.hx-slot-lock {
  display: none;
}

.hx-slot.is-locked .hx-slot-lock {
  display: block;
}

.hx-slot.is-locked .hx-slot-code {
  display: none;
}

#hud:not([data-layout-density='desktop']) .hx-slot-key {
  display: none;
}

/* 热焰弹 */
#hud-flares {
  align-items: center;
  gap: 8px;
}

.hx-fl-label {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--hud-ally, ${HUD_COLORS.ally});
  white-space: nowrap;
}

#hud-flares[data-empty='true'] .hx-fl-label {
  color: var(--hud-threat, ${HUD_COLORS.threat});
}

.hx-fl-pips {
  flex: none;
  display: flex;
  gap: 5px;
  padding: 0 2px;
}

.hx-fl-pip {
  width: 8px;
  height: 8px;
  box-sizing: border-box;
  transform: rotate(45deg);
  border: 1px solid rgba(244, 211, 94, 0.6);
}

.hx-fl-pip.is-on {
  background: var(--hud-ally, ${HUD_COLORS.ally});
  box-shadow: 0 0 6px rgba(244, 211, 94, 0.55);
}

.hx-fl-meter {
  position: relative;
  flex: 1;
  min-width: 24px;
  height: 4px;
  overflow: hidden;
  background: rgba(244, 211, 94, 0.14);
}

.hx-fl-fill {
  position: absolute;
  inset: 0;
  transform-origin: left center;
  transform: scaleX(0);
  background: rgba(244, 211, 94, 0.78);
}

.hx-fl-count {
  flex: none;
  font-family: var(--hud-mono, monospace);
  font-size: 11px;
  color: var(--hud-ally, ${HUD_COLORS.ally});
}

#hud-flares[data-empty='true'] .hx-fl-count {
  color: var(--hud-threat, ${HUD_COLORS.threat});
}

.hx-key {
  font-family: var(--hud-mono, monospace);
  font-size: 9px;
  line-height: 1.3;
  padding: 0 4px;
  border: 1px solid currentColor;
  border-radius: 3px;
  opacity: 0.75;
}

#hud:not([data-layout-density='desktop']) .hx-key {
  display: none;
}

/* ------------------------------------------------------------ 自动存档（驾驶舱信息栏下方，不撑宽信息栏） */
.hx-autosave {
  position: absolute;
  left: 0;
  top: calc(100% + 8px);
  width: max-content;
  align-items: center;
  gap: 7px;
  box-sizing: border-box;
  padding: 6px 11px 6px 9px;
  border-radius: 12px;
  border: 1px solid rgba(92, 255, 176, 0.38);
  background: linear-gradient(135deg, rgba(8, 28, 20, 0.88), rgba(8, 18, 16, 0.74));
  color: var(--hud-lock, ${HUD_COLORS.lock});
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  white-space: nowrap;
  text-shadow: none;
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.hx-autosave svg {
  flex: none;
  width: 14px;
  height: 14px;
}

/* 竖屏：放进顶部消息栈，与简报 / 目标同列 */
#hud-top-stack > .hx-autosave {
  position: static;
  align-self: center;
}

/* 手机横握：信息栏下方紧贴雷达，改放到雷达右侧 */
#hud[data-layout-density='touch-landscape'] .hx-autosave {
  position: fixed;
  top: auto;
  left: calc(max(20px, env(safe-area-inset-left)) + 84px);
  bottom: calc(max(20px, env(safe-area-inset-bottom)) + 139px);
}

.hx-autosave-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 400;
  letter-spacing: 0.04em;
  color: rgba(206, 255, 226, 0.82);
}

.hx-autosave[data-seq='a'] {
  animation: hx-toast-a 0.35s ease both;
}

.hx-autosave[data-seq='b'] {
  animation: hx-toast-b 0.35s ease both;
}

.hx-autosave.is-leaving {
  animation: none;
  opacity: 0;
  transform: translateX(-8px);
}

@keyframes hx-toast-a {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: none; }
}

@keyframes hx-toast-b {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: none; }
}

/* ------------------------------------------------------------ 视角标签（桌面：雷达上方） */
#hud-camera-mode {
  position: fixed;
  left: 20px;
  bottom: 152px;
  height: 24px;
  align-items: center;
  gap: 6px;
  padding: 0 8px 0 7px;
  box-sizing: border-box;
  border-radius: 12px;
  border: 1px solid rgba(143, 228, 255, 0.22);
  background: rgba(8, 14, 24, 0.58);
  color: var(--hud-muted, ${HUD_COLORS.muted});
  font-size: 12px;
  letter-spacing: 0.06em;
  text-shadow: none;
  white-space: nowrap;
  transition: color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

#hud-camera-mode svg {
  width: 14px;
  height: 14px;
  color: var(--hud-sys, ${HUD_COLORS.sys});
}

#hud-camera-mode.is-flash {
  color: #ffffff;
  border-color: var(--hud-sys, ${HUD_COLORS.sys});
  box-shadow: 0 0 14px rgba(143, 228, 255, 0.45);
}

/* ------------------------------------------------------------ Boss 阶段条（血条下方） */
#hud-boss-status {
  position: fixed;
  top: 48px;
  left: 50%;
  transform: translateX(-50%);
  max-width: min(70vw, 560px);
  height: 24px;
  box-sizing: border-box;
  align-items: center;
  gap: 9px;
  padding: 0 12px 0 3px;
  border: 1px solid rgba(255, 77, 77, 0.45);
  border-radius: 3px;
  background: linear-gradient(90deg, rgba(64, 8, 10, 0.82), rgba(8, 14, 24, 0.72));
  font-size: 13px;
  white-space: nowrap;
  text-shadow: none;
}

#hud[data-layout-density='touch-landscape'] #hud-boss-status {
  top: 34px;
  height: 20px;
  font-size: 12px;
}

/* 竖屏：在顶部消息栈里独占一行（无线电面板跟在栈底） */
#hud[data-layout-density='touch-portrait'] #hud-boss-status {
  position: static;
  width: 100%;
  transform: none;
  max-width: none;
  height: 22px;
  font-size: 12px;
}

.hx-boss-tag {
  flex: none;
  padding: 1px 6px;
  border-radius: 2px;
  background: var(--hud-threat, ${HUD_COLORS.threat});
  color: #1c0404;
  font-family: var(--hud-mono, monospace);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.hx-boss-pips {
  flex: none;
  display: flex;
  gap: 6px;
  padding: 0 2px;
}

.hx-boss-pip {
  width: 9px;
  height: 9px;
  box-sizing: border-box;
  transform: rotate(45deg);
  border: 1px solid rgba(255, 77, 77, 0.75);
}

.hx-boss-pip.is-past {
  background: rgba(255, 77, 77, 0.4);
}

.hx-boss-pip.is-current {
  background: var(--hud-threat, ${HUD_COLORS.threat});
  box-shadow: 0 0 8px rgba(255, 77, 77, 0.9);
}

.hx-boss-phase {
  flex: none;
  font-family: var(--hud-mono, monospace);
  font-size: 11px;
  color: rgba(255, 205, 205, 0.88);
}

.hx-boss-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #ffeaea;
  letter-spacing: 0.04em;
}

#hud-boss-status.is-phase-up {
  animation: hx-phase-up 1.2s ease-out both;
}

@keyframes hx-phase-up {
  0% { box-shadow: 0 0 0 0 rgba(255, 77, 77, 0.9); border-color: #ffffff; }
  100% { box-shadow: 0 0 0 14px rgba(255, 77, 77, 0); border-color: rgba(255, 77, 77, 0.45); }
}

/* ------------------------------------------------------------ 告警通道（准星下方） */
#hud-warning-lane {
  position: fixed;
  left: 50%;
  top: calc(50% + 11vmin + 18px);
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: max-content;
  max-width: min(90vw, 560px);
  pointer-events: none;
  z-index: 6;
}

#hud[data-layout-density='touch-landscape'] #hud-warning-lane {
  top: calc(50% + min(9vmin, 90px) + 12px);
  gap: 5px;
}

#hud[data-layout-density='touch-portrait'] #hud-warning-lane {
  top: calc(50% + min(8vmin, 80px) + 14px);
  gap: 6px;
}

#hud-missile-warning {
  align-items: center;
  gap: 10px;
  padding: 5px 14px 5px 10px;
  border: 1px solid currentColor;
  border-radius: 2px;
  text-shadow: none;
  white-space: nowrap;
}

#hud-missile-warning svg {
  width: 18px;
  height: 18px;
  flex: none;
}

.hx-mw-main {
  font-size: 16px;
  font-weight: 900;
  letter-spacing: 0.24em;
}

.hx-mw-hint {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  opacity: 0.9;
}

#hud-missile-warning[data-level='locking'] {
  color: var(--hud-weapon, ${HUD_COLORS.weapon});
  background: rgba(44, 26, 6, 0.72);
  animation: hx-blink 1s steps(2) infinite;
}

#hud-missile-warning[data-level='incoming'] {
  color: #ffffff;
  border-color: var(--hud-threat, ${HUD_COLORS.threat});
  background: rgba(150, 14, 14, 0.78);
  box-shadow: 0 0 18px rgba(255, 60, 60, 0.45);
  animation: hx-blink 0.5s steps(2) infinite;
}

#hud-missile-warning[data-level='incoming'] svg {
  color: #ffd1d1;
}

@keyframes hx-blink {
  50% { opacity: 0.55; }
}

#hud-flash-warning {
  align-items: center;
  gap: 8px;
  max-width: min(86vw, 520px);
  padding: 5px 16px;
  box-sizing: border-box;
  border-top: 1px solid currentColor;
  border-bottom: 1px solid currentColor;
  background: linear-gradient(90deg, transparent, rgba(8, 14, 24, 0.82) 14%, rgba(8, 14, 24, 0.82) 86%, transparent);
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-align: center;
  text-shadow: 0 0 10px rgba(0, 0, 0, 0.6);
  color: var(--hud-threat, ${HUD_COLORS.threat});
}

#hud-flash-warning svg {
  flex: none;
  width: 16px;
  height: 16px;
}

#hud-flash-warning:not([data-tone='threat']) svg {
  display: none;
}

#hud-flash-warning[data-tone='sys'] {
  color: var(--hud-sys, ${HUD_COLORS.sys});
}

#hud-flash-warning[data-tone='ally'] {
  color: var(--hud-ally, ${HUD_COLORS.ally});
}

.hx-flash-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

#hud-flash-warning[data-seq='a'] {
  animation: hx-flash-a 0.36s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

#hud-flash-warning[data-seq='b'] {
  animation: hx-flash-b 0.36s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

@keyframes hx-flash-a {
  from { opacity: 0; transform: scaleX(0.7); }
  to { opacity: 1; transform: none; }
}

@keyframes hx-flash-b {
  from { opacity: 0; transform: scaleX(0.7); }
  to { opacity: 1; transform: none; }
}

#hud:not([data-layout-density='desktop']) .hx-mw-main {
  font-size: 14px;
}

#hud:not([data-layout-density='desktop']) .hx-mw-hint,
#hud:not([data-layout-density='desktop']) #hud-flash-warning {
  font-size: 12px;
}

/* ------------------------------------------------------------ 屏幕边缘告警 */
#hud-edge-alert {
  position: fixed;
  inset: 0;
  display: none;
  pointer-events: none;
  z-index: 3;
}

#hud-edge-alert[data-level='locking'] {
  display: block;
  box-shadow: inset 0 0 0 2px rgba(255, 179, 71, 0.35), inset 0 0 70px rgba(255, 179, 71, 0.16);
  animation: hx-edge 1.6s ease-in-out infinite;
}

#hud-edge-alert[data-level='incoming'] {
  display: block;
  box-shadow: inset 0 0 0 3px rgba(255, 77, 77, 0.6), inset 0 0 110px rgba(255, 36, 36, 0.32);
  animation: hx-edge 0.9s ease-in-out infinite;
}

@keyframes hx-edge {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}

/* ------------------------------------------------------------ 第一人称：下方面板贴合仪表板 */
#hud[data-camera-mode='first-person'] #hud-stores,
#hud[data-camera-mode='first-person'] #hud-camera-mode {
  border-radius: 3px;
  border-color: rgba(92, 255, 176, 0.26);
  background:
    repeating-linear-gradient(0deg, rgba(92, 255, 176, 0.035) 0, rgba(92, 255, 176, 0.035) 1px, transparent 1px, transparent 3px),
    rgba(3, 10, 9, 0.86);
  box-shadow: inset 0 0 22px rgba(92, 255, 176, 0.06), 0 10px 20px rgba(0, 0, 0, 0.3);
}

@media (prefers-reduced-motion: reduce) {
  #hud-missile-warning,
  #hud-edge-alert,
  #hud-flash-warning,
  #hud-boss-status.is-phase-up,
  .hx-autosave,
  #hud-weapon-panel[data-overheated='true'] .hx-meter-fill {
    animation: none !important;
  }
}
`;

export function injectHudExtrasStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(HUD_EXTRAS_STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = HUD_EXTRAS_STYLE_ID;
  style.textContent = HUD_EXTRAS_CSS;
  document.head.appendChild(style);
}
