import { HUD_COLORS, HUD_LAYERS, HUD_SERIF_STACK } from './hudTokens';

/**
 * 剧情覆盖层（章节卡 / 结算 / 结局字幕）样式。
 *
 * 版式：电影遮幅（上下黑边）+ 左右两栏“任务档案”——左栏是章节身份与十个航路点组成的战役航线，
 * 右栏是打字机正文与目标清单。竖屏改为单栏，矮横屏（手机横握）压缩字号与留白。
 */
export const STORY_STYLE_ID = 'story-overlay-style';

const STORY_CSS = `
#story-overlay {
  --so-bar-h: 8vh;
  --so-ink: #02060c;
  --so-ice: var(--hud-sys, ${HUD_COLORS.sys});
  --so-amber: var(--hud-weapon, ${HUD_COLORS.weapon});
  --so-red: var(--hud-threat, ${HUD_COLORS.threat});
  --so-green: var(--hud-lock, ${HUD_COLORS.lock});
  --so-gold: var(--hud-ally, ${HUD_COLORS.ally});
  --so-text: var(--hud-text, ${HUD_COLORS.text});
  --so-muted: var(--hud-muted, ${HUD_COLORS.muted});
  --so-serif: var(--hud-serif, ${HUD_SERIF_STACK});
  position: fixed;
  inset: 0;
  z-index: ${HUD_LAYERS.story};
  color: var(--so-text);
  font-family: var(--hud-font, 'Arial', sans-serif);
  pointer-events: auto;
  cursor: pointer;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  opacity: 1;
  visibility: visible;
  transition: opacity 0.28s ease, visibility 0s linear 0s;
}

/* 收起：先淡出，再在淡出结束时切到 visibility: hidden */
#story-overlay.is-leaving {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.28s ease, visibility 0s linear 0.28s;
}

#story-overlay .so-backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(120% 95% at 30% 42%, rgba(12, 26, 44, 0.58), rgba(2, 6, 12, 0.95) 72%),
    linear-gradient(180deg, rgba(2, 6, 12, 0.66), rgba(2, 6, 12, 0.88));
}

/* 卡片期间收起战斗 HUD 与指示层（只改可见性，不影响布局与输入状态） */
:root[data-story-overlay] #hud,
:root[data-story-overlay] #radar-minimap,
:root[data-story-overlay] #radio-comms,
:root[data-story-overlay] #mobile-controls,
:root[data-story-overlay] #lock-on-indicator,
:root[data-story-overlay] #enemy-health-bars,
:root[data-story-overlay] #enemy-indicators,
:root[data-story-overlay] #boss-missile-indicators,
:root[data-story-overlay] .hit-marker {
  visibility: hidden;
}

#story-overlay .so-backdrop::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(143, 228, 255, 0.035) 0,
    rgba(143, 228, 255, 0.035) 1px,
    transparent 1px,
    transparent 3px
  );
  pointer-events: none;
}

#story-overlay .so-bar {
  position: absolute;
  left: 0;
  right: 0;
  box-sizing: border-box;
  background: #000;
  z-index: 2;
  animation: so-bar-in 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

/* 黑边延伸进刘海 / 底部安全区，内容区始终是 --so-bar-h 高 */
#story-overlay .so-bar-top {
  top: 0;
  height: calc(var(--so-bar-h) + env(safe-area-inset-top));
  transform-origin: top;
}

#story-overlay .so-bar-bottom {
  bottom: 0;
  height: calc(var(--so-bar-h) + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  transform-origin: bottom;
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes so-bar-in {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}

#story-overlay .so-stage {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding:
    calc(var(--so-bar-h) + env(safe-area-inset-top) + 28px)
    max(40px, env(safe-area-inset-right))
    calc(var(--so-bar-h) + env(safe-area-inset-bottom) + 24px)
    max(40px, env(safe-area-inset-left));
}

/* ---------------------------------------------------------------- 档案卡片 */
#story-overlay .so-card {
  margin: auto;
  width: min(1040px, 100%);
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) 1px minmax(0, 1.65fr);
  grid-template-areas:
    'ident rule text'
    'ident rule extras';
  grid-template-rows: auto 1fr;
  column-gap: clamp(22px, 3.6vw, 52px);
  align-items: start;
}

#story-overlay .so-card.is-debrief {
  grid-template-areas: 'ident rule text';
  grid-template-rows: auto;
}

#story-overlay .so-ident {
  grid-area: ident;
  min-width: 0;
}

#story-overlay .so-rule {
  grid-area: rule;
  align-self: stretch;
  width: 1px;
  min-height: 100%;
  position: relative;
  background: linear-gradient(
    180deg,
    transparent,
    rgba(143, 228, 255, 0.5) 10%,
    rgba(143, 228, 255, 0.5) 90%,
    transparent
  );
}

#story-overlay .so-rule::before {
  content: '';
  position: absolute;
  left: -4px;
  width: 9px;
  top: 12%;
  bottom: 12%;
  background: repeating-linear-gradient(
    180deg,
    rgba(143, 228, 255, 0.45) 0,
    rgba(143, 228, 255, 0.45) 1px,
    transparent 1px,
    transparent 26px
  );
}

#story-overlay .so-kicker {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  font-family: var(--so-serif);
  font-size: clamp(15px, 1.5vw, 19px);
  letter-spacing: 0.3em;
  color: var(--so-ice);
}

#story-overlay .so-status {
  font-family: var(--hud-font, 'Arial', sans-serif);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.24em;
  color: var(--so-green);
  border: 1px solid rgba(92, 255, 176, 0.55);
  padding: 2px 8px 2px 10px;
}

#story-overlay .so-title {
  margin: 10px 0 12px;
  font-family: var(--so-serif);
  font-weight: 900;
  font-size: clamp(36px, 5.2vw, 66px);
  line-height: 1.08;
  letter-spacing: 0.06em;
  color: #f4faff;
  text-shadow: 0 0 26px rgba(143, 228, 255, 0.26), 0 2px 0 rgba(0, 0, 0, 0.55);
  animation: so-title-in 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) 0.15s both;
}

@keyframes so-title-in {
  from { clip-path: inset(0 100% 0 0); opacity: 0.2; }
  to { clip-path: inset(0 0 0 0); opacity: 1; }
}

#story-overlay .so-operation {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
}

#story-overlay .so-op-cn {
  font-size: clamp(14px, 1.25vw, 17px);
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--so-text);
}

#story-overlay .so-op-code {
  font-family: var(--hud-mono, monospace);
  font-size: 11px;
  letter-spacing: 0.2em;
  color: var(--so-muted);
}

#story-overlay .so-location {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  letter-spacing: 0.06em;
  color: var(--so-muted);
}

#story-overlay .so-location svg {
  flex: none;
  width: 15px;
  height: 15px;
  color: var(--so-ice);
}

/* 战役航线：十个航路点 */
#story-overlay .so-route {
  margin-top: 26px;
  max-width: 330px;
}

#story-overlay .so-route-track {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 22px;
}

#story-overlay .so-route-track::before {
  content: '';
  position: absolute;
  left: 4px;
  right: 4px;
  top: 50%;
  height: 1px;
  background: rgba(143, 228, 255, 0.32);
}

#story-overlay .so-waypoint {
  position: relative;
  width: 9px;
  height: 9px;
  box-sizing: border-box;
  transform: rotate(45deg);
  border: 1px solid rgba(143, 228, 255, 0.45);
  background: var(--so-ink);
  animation: so-waypoint-in 0.3s ease both;
  animation-delay: calc(var(--i, 0) * 55ms + 0.35s);
}

#story-overlay .so-waypoint.is-done {
  border-color: var(--so-ice);
  background: rgba(143, 228, 255, 0.75);
}

#story-overlay .so-waypoint.is-current {
  width: 14px;
  height: 14px;
  border-color: #ffffff;
  background: var(--so-ice);
  box-shadow: 0 0 0 4px rgba(143, 228, 255, 0.14), 0 0 18px rgba(143, 228, 255, 0.85);
}

#story-overlay .so-card.is-debrief .so-waypoint.is-current {
  background: var(--so-green);
  box-shadow: 0 0 0 4px rgba(92, 255, 176, 0.14), 0 0 18px rgba(92, 255, 176, 0.8);
}

@keyframes so-waypoint-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

#story-overlay .so-route-caption {
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  font-family: var(--hud-mono, monospace);
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--so-muted);
}

/* ---------------------------------------------------------------- 正文 / 打字机 */
#story-overlay .so-text {
  grid-area: text;
  min-width: 0;
  max-width: 36em;
  font-family: var(--so-serif);
  font-size: clamp(15px, 1.32vw, 18px);
  line-height: 1.95;
  color: rgba(238, 248, 255, 0.94);
}

#story-overlay .so-para {
  margin: 0 0 0.85em;
  text-wrap: pretty;
}

#story-overlay .so-para:last-child {
  margin-bottom: 0;
}

/* 未显示的字以不可见伪元素占位：排版从第一帧起就固定，打字时不跳行 */
#story-overlay .so-para::after {
  content: attr(data-rest);
  visibility: hidden;
}

#story-overlay .so-caret {
  display: none;
  width: 2px;
  height: 1.05em;
  margin: 0 -2px -0.16em 1px;
  background: var(--so-ice);
  box-shadow: 0 0 8px rgba(143, 228, 255, 0.9);
  animation: so-caret 1s steps(1) infinite;
}

#story-overlay .so-para.is-typing .so-caret {
  display: inline-block;
}

@keyframes so-caret {
  50% { opacity: 0; }
}

#story-overlay .so-extras {
  grid-area: extras;
  min-width: 0;
  margin-top: 22px;
  max-width: 36em;
  transition: opacity 0.5s ease, transform 0.5s ease;
}

#story-overlay .so-extras.is-pending {
  opacity: 0;
  transform: translateY(6px);
}

#story-overlay .so-obj-title {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: var(--so-ice);
}

#story-overlay .so-objectives {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 7px;
}

#story-overlay .so-objectives li {
  display: flex;
  align-items: baseline;
  gap: 11px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--so-text);
}

#story-overlay .so-objectives li::before {
  content: '';
  flex: none;
  width: 7px;
  height: 7px;
  box-sizing: border-box;
  border: 1px solid var(--so-ice);
  transform: rotate(45deg) translateY(-2px);
}

#story-overlay .so-unlock {
  margin-top: 16px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 14px 10px 12px;
  border-left: 2px solid var(--so-amber);
  background: linear-gradient(90deg, rgba(255, 179, 71, 0.14), rgba(255, 179, 71, 0));
  font-size: 14px;
  line-height: 1.6;
  color: #ffe4bf;
}

#story-overlay .so-unlock-tag {
  flex: none;
  margin-top: 2px;
  padding: 1px 7px;
  border-radius: 2px;
  background: var(--so-amber);
  color: #1c1306;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
}

#story-overlay .so-final {
  max-width: 330px;
  margin-top: 6px;
}

/* ---------------------------------------------------------------- 结算 */
#story-overlay .so-text.so-debrief {
  font-family: var(--hud-font, 'Arial', sans-serif);
  line-height: 1.35;
}

#story-overlay .so-summary {
  margin-top: 22px;
  font-family: var(--so-serif);
  font-size: 15px;
  line-height: 1.85;
  color: rgba(238, 248, 255, 0.9);
}

#story-overlay .so-tally {
  margin: 0;
  display: grid;
  font-variant-numeric: tabular-nums;
}

#story-overlay .so-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(143, 228, 255, 0.12);
  animation: so-row-in 0.38s ease both;
  animation-delay: calc(var(--i, 0) * 110ms + 0.3s);
}

#story-overlay .so-row dt {
  min-width: 0;
  font-size: 14px;
  letter-spacing: 0.08em;
  color: var(--so-muted);
}

#story-overlay .so-row dd {
  margin: 0;
  flex: none;
  font-family: var(--hud-mono, monospace);
  font-size: 19px;
  font-weight: 700;
  color: var(--so-text);
}

#story-overlay .so-row[data-tone='threat'] dd {
  color: var(--so-red);
}

#story-overlay .so-row[data-tone='ally'] dd {
  color: var(--so-gold);
}

#story-overlay .so-row.is-bonus dt {
  color: rgba(244, 211, 94, 0.88);
}

#story-overlay .so-row.is-bonus[data-tone='threat'] dt {
  color: rgba(255, 150, 150, 0.88);
}

#story-overlay .so-row.is-total {
  margin-top: 6px;
  padding-top: 14px;
  border-bottom: 0;
  border-top: 1px solid rgba(143, 228, 255, 0.45);
}

#story-overlay .so-row.is-total dt {
  color: var(--so-text);
  font-weight: 700;
}

#story-overlay .so-row.is-total dd {
  font-size: clamp(26px, 2.6vw, 34px);
  color: #ffffff;
  text-shadow: 0 0 18px rgba(143, 228, 255, 0.45);
}

@keyframes so-row-in {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: none; }
}

#story-overlay .so-actions {
  margin-top: 22px;
  display: flex;
  justify-content: flex-end;
}

#story-overlay .so-continue {
  min-width: 168px;
  min-height: 48px;
  padding: 0 28px;
  border: 1px solid var(--so-ice);
  border-radius: 2px;
  background: linear-gradient(180deg, rgba(143, 228, 255, 0.2), rgba(143, 228, 255, 0.08));
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.3em;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 0 22px rgba(143, 228, 255, 0.18);
}

#story-overlay .so-continue:focus-visible,
#story-overlay .so-skip:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 3px;
}

#story-overlay .so-continue:active {
  background: rgba(143, 228, 255, 0.28);
}

#story-overlay.is-instant .so-row,
#story-overlay.is-instant .so-waypoint,
#story-overlay.is-instant .so-title {
  animation: none;
}

#story-overlay.is-instant .so-extras {
  transition: none;
}

/* ---------------------------------------------------------------- 片尾字幕 */
#story-overlay .so-credits {
  position: absolute;
  inset: 0;
  z-index: 1;
  overflow: hidden;
}

#story-overlay .so-roll {
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  display: grid;
  justify-items: center;
  gap: 26px;
  padding: 0 24px;
  animation-name: so-roll;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

@keyframes so-roll {
  from { transform: translateY(0); }
  to { transform: translateY(calc(-100% - 100vh)); }
}

#story-overlay .so-roll-title {
  margin-bottom: 18px;
  display: grid;
  justify-items: center;
  gap: 8px;
  font-family: var(--so-serif);
  font-weight: 900;
  font-size: clamp(30px, 4vw, 52px);
  letter-spacing: 0.14em;
  text-align: center;
  color: #f4faff;
  text-shadow: 0 0 24px rgba(143, 228, 255, 0.3);
}

#story-overlay .so-roll-latin {
  font-family: var(--hud-font, 'Arial', sans-serif);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5em;
  text-indent: 0.5em;
  color: var(--so-muted);
  text-shadow: none;
}

#story-overlay .so-roll-row {
  width: min(560px, 100%);
  display: grid;
  grid-template-columns: minmax(0, 1fr) 22px minmax(0, 1fr);
  align-items: center;
  column-gap: 16px;
}

#story-overlay .so-role {
  text-align: right;
  font-size: 14px;
  letter-spacing: 0.16em;
  color: var(--so-muted);
}

#story-overlay .so-roll-sep {
  height: 1px;
  background: rgba(143, 228, 255, 0.55);
}

#story-overlay .so-name {
  text-align: left;
  font-family: var(--so-serif);
  font-size: clamp(18px, 1.8vw, 22px);
  color: #ffffff;
}

#story-overlay .so-roll-line {
  font-family: var(--so-serif);
  font-size: 18px;
  letter-spacing: 0.12em;
  color: var(--so-text);
  text-align: center;
}

#story-overlay .so-finale {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
  transition: opacity 0.8s ease;
}

#story-overlay .so-finale.is-pending {
  opacity: 0;
}

#story-overlay .so-finale-label {
  font-size: 13px;
  letter-spacing: 0.32em;
  color: var(--so-muted);
}

#story-overlay .so-finale-score {
  font-family: var(--hud-mono, monospace);
  font-size: clamp(40px, 6vw, 72px);
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 0 28px rgba(143, 228, 255, 0.5);
}

#story-overlay .so-finale-line {
  margin-top: 18px;
  font-family: var(--so-serif);
  font-size: clamp(20px, 2.4vw, 28px);
  letter-spacing: 0.4em;
  color: var(--so-ice);
}

/* ---------------------------------------------------------------- 跳过 / 提示（都在下方黑边里） */
#story-overlay .so-skip {
  position: absolute;
  z-index: 3;
  top: calc(var(--so-bar-h) / 2);
  right: max(18px, env(safe-area-inset-right));
  transform: translateY(-50%);
  height: min(34px, calc(var(--so-bar-h) - 6px));
  padding: 0 12px 0 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(143, 228, 255, 0.35);
  border-radius: 2px;
  background: rgba(2, 6, 12, 0.55);
  color: var(--so-muted);
  font-size: 13px;
  letter-spacing: 0.2em;
  cursor: pointer;
  pointer-events: auto;
}

/* 视觉尺寸受黑边限制，点击区域向外扩大 */
#story-overlay .so-skip::after {
  content: '';
  position: absolute;
  inset: -10px -8px;
}

#story-overlay .so-skip:hover {
  color: #ffffff;
  border-color: var(--so-ice);
}

#story-overlay .so-key {
  font-family: var(--hud-mono, monospace);
  font-size: 10px;
  letter-spacing: 0.04em;
  padding: 1px 5px;
  border: 1px solid currentColor;
  border-radius: 3px;
  opacity: 0.8;
}

#story-overlay .so-prompt {
  font-size: 12px;
  letter-spacing: 0.22em;
  color: rgba(183, 231, 255, 0.72);
  white-space: nowrap;
  animation: so-prompt 2.4s ease-in-out infinite;
}

@keyframes so-prompt {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
}

#story-overlay[data-density='desktop'] .so-touch-only,
#story-overlay:not([data-density='desktop']) .so-desktop-only {
  display: none;
}

/* ---------------------------------------------------------------- 竖屏：单栏 */
@media (max-aspect-ratio: 1/1) {
  #story-overlay {
    --so-bar-h: 6vh;
  }

  #story-overlay .so-stage {
    padding-left: max(22px, env(safe-area-inset-left));
    padding-right: max(22px, env(safe-area-inset-right));
  }

  #story-overlay .so-card,
  #story-overlay .so-card.is-debrief {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'ident' 'text' 'extras';
    grid-template-rows: auto;
    row-gap: 22px;
  }

  #story-overlay .so-rule {
    display: none;
  }

  #story-overlay .so-title {
    font-size: clamp(30px, 9vw, 42px);
  }

  #story-overlay .so-route {
    max-width: none;
  }

  #story-overlay .so-extras {
    margin-top: 0;
  }

  #story-overlay .so-text {
    font-size: 16px;
    line-height: 1.9;
  }
}

/* ---------------------------------------------------------------- 矮横屏（手机横握） */
@media (max-height: 520px) and (min-aspect-ratio: 1/1) {
  #story-overlay {
    --so-bar-h: 8vh;
  }

  #story-overlay .so-stage {
    padding:
      calc(var(--so-bar-h) + env(safe-area-inset-top) + 10px)
      max(24px, env(safe-area-inset-right))
      calc(var(--so-bar-h) + env(safe-area-inset-bottom) + 8px)
      max(24px, env(safe-area-inset-left));
  }

  #story-overlay .so-card {
    column-gap: 24px;
  }

  #story-overlay .so-kicker {
    font-size: 13px;
  }

  #story-overlay .so-title {
    margin: 4px 0 6px;
    font-size: 28px;
  }

  #story-overlay .so-op-cn {
    font-size: 13px;
  }

  #story-overlay .so-op-code {
    font-size: 10px;
  }

  #story-overlay .so-location {
    margin-top: 6px;
    font-size: 12px;
  }

  #story-overlay .so-route {
    margin-top: 12px;
  }

  #story-overlay .so-text {
    font-size: 14px;
    line-height: 1.72;
  }

  #story-overlay .so-para {
    margin-bottom: 0.5em;
  }

  #story-overlay .so-extras {
    margin-top: 14px;
  }

  #story-overlay .so-obj-title {
    margin-bottom: 4px;
    font-size: 11px;
  }

  #story-overlay .so-objectives {
    gap: 3px;
  }

  #story-overlay .so-objectives li {
    font-size: 12.5px;
  }

  #story-overlay .so-unlock {
    margin-top: 10px;
    padding: 6px 10px;
    font-size: 12.5px;
    line-height: 1.5;
  }

  #story-overlay .so-summary {
    margin-top: 10px;
    font-size: 13px;
    line-height: 1.65;
  }

  #story-overlay .so-row {
    padding: 4px 0;
  }

  #story-overlay .so-row dt {
    font-size: 12.5px;
  }

  #story-overlay .so-row dd {
    font-size: 16px;
  }

  #story-overlay .so-row.is-total {
    padding-top: 8px;
  }

  #story-overlay .so-row.is-total dd {
    font-size: 24px;
  }

  #story-overlay .so-actions {
    margin-top: 10px;
  }

  #story-overlay .so-continue {
    min-height: 44px;
  }

  #story-overlay .so-prompt {
    font-size: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  #story-overlay .so-bar,
  #story-overlay .so-title,
  #story-overlay .so-waypoint,
  #story-overlay .so-row,
  #story-overlay .so-prompt,
  #story-overlay .so-caret {
    animation: none;
  }

  #story-overlay .so-extras,
  #story-overlay .so-finale {
    transition: none;
  }
}
`;

export function injectStoryStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STORY_STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = STORY_STYLE_ID;
  style.textContent = STORY_CSS;
  document.head.appendChild(style);
}
