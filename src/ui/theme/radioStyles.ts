import { HUD_COLORS, HUD_LAYERS, HUD_TONE_COLORS } from './hudPalette';

/**
 * 无线电通讯面板样式。
 *
 * 位置避开准星与雷达：桌面贴底、紧挨雷达右侧；手机横握夹在摇杆与右侧按键簇之间；
 * 竖屏第一人称放到顶部状态栏下方，竖屏追尾视角（准星在屏幕上方）放到按键簇左侧、摇杆上方。
 * 按键簇尺寸由 index.html 的 --touch-deck-w / --touch-deck-h / --touch-stick-size 提供。
 */
export const RADIO_STYLE_ID = 'radio-comms-style';

function toneBlock(tone: keyof typeof HUD_TONE_COLORS, rgb: string): string {
  return `
#radio-comms[data-tone='${tone}'] {
  --rc-tone: ${HUD_TONE_COLORS[tone]};
  --rc-tone-soft: rgba(${rgb}, 0.42);
  --rc-tone-glow: rgba(${rgb}, 0.22);
}`;
}

const RADIO_CSS = `
#radio-comms {
  --rc-tone: ${HUD_COLORS.sys};
  --rc-tone-soft: rgba(143, 228, 255, 0.42);
  --rc-tone-glow: rgba(143, 228, 255, 0.22);
  position: fixed;
  z-index: ${HUD_LAYERS.radio};
  left: 156px;
  bottom: 20px;
  width: min(520px, calc(100vw - 424px));
  box-sizing: border-box;
  pointer-events: none;
  color: var(--hud-text, ${HUD_COLORS.text});
  font-family: var(--hud-font, 'Arial', sans-serif);
}
${toneBlock('sys', '143, 228, 255')}
${toneBlock('ally', '244, 211, 94')}
${toneBlock('weapon', '255, 179, 71')}
${toneBlock('threat', '255, 77, 77')}
${toneBlock('muted', '195, 204, 214')}

#radio-comms .rc-panel {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 14px 11px 10px;
  box-sizing: border-box;
  background: linear-gradient(90deg, rgba(6, 12, 22, 0.88), rgba(8, 14, 24, 0.74));
  border: 1px solid rgba(143, 228, 255, 0.2);
  border-left: 3px solid var(--rc-tone);
  border-radius: 4px 10px 10px 4px;
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: opacity 0.26s ease, transform 0.26s ease;
}

#radio-comms[data-seq='a'] .rc-panel {
  animation: rc-in-a 0.26s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

#radio-comms[data-seq='b'] .rc-panel {
  animation: rc-in-b 0.26s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

@keyframes rc-in-a {
  from { opacity: 0; transform: translateX(-10px); }
  to { opacity: 1; transform: none; }
}

@keyframes rc-in-b {
  from { opacity: 0; transform: translateX(-10px); }
  to { opacity: 1; transform: none; }
}

#radio-comms.is-out .rc-panel {
  animation: none;
  opacity: 0;
  transform: translateY(6px);
}

#radio-comms[data-priority='high'] .rc-panel {
  border-color: var(--rc-tone-soft);
  border-left-color: var(--rc-tone);
  box-shadow: 0 0 18px var(--rc-tone-glow), 0 12px 24px rgba(0, 0, 0, 0.3);
}

#radio-comms .rc-portrait {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--rc-tone);
  background: radial-gradient(circle at 50% 38%, rgba(255, 255, 255, 0.09), rgba(0, 0, 0, 0.4));
  box-shadow: inset 0 0 0 1px var(--rc-tone-soft), 0 0 14px var(--rc-tone-glow);
}

#radio-comms .rc-portrait svg {
  width: 22px;
  height: 22px;
}

#radio-comms .rc-body {
  flex: 1;
  min-width: 0;
}

#radio-comms .rc-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 3px;
}

#radio-comms .rc-callsign {
  flex: none;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: var(--rc-tone);
}

#radio-comms .rc-name {
  min-width: 0;
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--hud-muted, ${HUD_COLORS.muted});
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

#radio-comms .rc-signal {
  flex: none;
  margin-left: auto;
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 10px;
}

#radio-comms .rc-signal i {
  display: block;
  width: 2px;
  background: var(--rc-tone);
  animation: rc-signal 0.9s ease-in-out infinite;
}

#radio-comms .rc-signal i:nth-child(1) { height: 4px; }
#radio-comms .rc-signal i:nth-child(2) { height: 7px; animation-delay: 0.15s; }
#radio-comms .rc-signal i:nth-child(3) { height: 10px; animation-delay: 0.3s; }

#radio-comms[data-phase='hold'] .rc-signal i,
#radio-comms.is-out .rc-signal i {
  animation: none;
  opacity: 0.45;
}

@keyframes rc-signal {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}

#radio-comms .rc-text {
  font-size: 15px;
  line-height: 1.5;
  color: var(--hud-text, ${HUD_COLORS.text});
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 神谕：红色串扰 */
#radio-comms[data-speaker='oracle'] .rc-text {
  color: #ffdcdc;
  text-shadow: 1px 0 rgba(255, 77, 77, 0.6), -1px 0 rgba(143, 228, 255, 0.35);
  animation: rc-glitch 3.2s steps(1) infinite;
}

#radio-comms[data-speaker='oracle'] .rc-panel {
  background:
    repeating-linear-gradient(0deg, rgba(255, 77, 77, 0.06) 0, rgba(255, 77, 77, 0.06) 1px, transparent 1px, transparent 3px),
    linear-gradient(90deg, rgba(24, 6, 8, 0.9), rgba(12, 8, 14, 0.76));
}

@keyframes rc-glitch {
  0%, 86%, 100% { transform: none; }
  88% { transform: translateX(1px); }
  90% { transform: translateX(-2px); }
  92% { transform: none; }
}

#radio-comms .rc-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

/* 第一人称：面板贴在仪表板上，改成多功能显示器风格 */
:root[data-hud-camera='first-person'] #radio-comms:not([data-density='touch-portrait']) .rc-panel {
  border-radius: 3px;
  border-color: rgba(92, 255, 176, 0.22);
  border-left-color: var(--rc-tone);
  background:
    repeating-linear-gradient(0deg, rgba(92, 255, 176, 0.035) 0, rgba(92, 255, 176, 0.035) 1px, transparent 1px, transparent 3px),
    rgba(3, 10, 9, 0.86);
  box-shadow: inset 0 0 22px rgba(92, 255, 176, 0.06), 0 10px 20px rgba(0, 0, 0, 0.3);
}

/* 手机横握：夹在摇杆和按键簇之间 */
#radio-comms[data-density='touch-landscape'] {
  left: calc(max(20px, env(safe-area-inset-left)) + var(--touch-stick-size, 108px) + 14px);
  right: calc(max(20px, env(safe-area-inset-right)) + var(--touch-deck-w, 252px) + 14px);
  bottom: max(12px, env(safe-area-inset-bottom));
  width: auto;
  max-width: 560px;
}

/*
 * 竖屏：顶部状态栏下方整行，排在 HUD 顶部消息栈（Boss 阶段条 / 简报 / 事件目标）之后；
 * HUD 把栈底的视口坐标写在 <html> 的 --hud-stack-bottom，HUD 未挂载时退回状态栏下方
 */
#radio-comms[data-density='touch-portrait'] {
  left: max(10px, env(safe-area-inset-left));
  right: max(10px, env(safe-area-inset-right));
  top: calc(var(--hud-stack-bottom, calc(128px + env(safe-area-inset-top, 0px))) + 8px);
  bottom: auto;
  width: auto;
}

/*
 * 竖屏追尾视角：准星与导弹捕获环在屏幕上方约 29% 处，正好是消息栈下方这一带，
 * 面板留在那里会盖住准星和正在瞄的目标。改放到触控按键簇上方、向上生长
 * （按键簇高度由 index.html 的 --touch-deck-h 提供；第一人称准星在屏幕中心，仍用上面的位置）
 */
:root:not([data-hud-camera='first-person']) #radio-comms[data-density='touch-portrait'] {
  top: auto;
  bottom: calc(max(20px, env(safe-area-inset-bottom)) + var(--touch-deck-h, 240px) + 8px);
}

/*
 * 手机竖屏追尾视角（宽度不到 700px）：按键簇上方那一带是机体和告警通道（第一行在屏幕中线下方
 * 约 45–75px），整行的面板放在那里会压住导弹告警、横在画面中间。面板改放到按键簇左侧、
 * 静止摇杆上方 14px（平板竖屏的面板也在这一处），不显示头像；告警通道显示几行都在这里，不再变。
 * 这一栏很窄（屏宽 − 254px），左右内边距收到 6px；正文的行数上限按视口高度分档（见下面几条）：
 * 面板到了上限，上沿离两行告警（导弹告警 + 闪烁告警）的下沿仍至少 12px。算法（屏宽按 430px
 * 以内，两行告警按中文字体的 67px 高）：
 *   面板高 = 行数 × 16.9px + 8px（带呼号行再加 18.6px）
 *   可用高 = 50vh − 8vmin − 203px − max(20px, 底部安全区)
 * 五行及以上的档按底部有 34px 安全区算，四行及以下的档（没有主屏幕指示条的手机、带着工具栏的
 * 手机浏览器）按没有安全区算。
 * 正文比行数上限长时不在这里截掉：RadioComms 把正文换成同样高的裁切框，里面的文字像字幕一样
 * 逐行上移（radioFollowOffset），这里的行数上限就是面板里同时可见的行数
 */
@media (orientation: portrait) and (max-width: 699.98px) {
  :root:not([data-hud-camera='first-person']) #radio-comms[data-density='touch-portrait'] {
    right: calc(max(20px, env(safe-area-inset-right)) + var(--touch-deck-w, 210px) + 14px);
    bottom: calc(max(20px, env(safe-area-inset-bottom)) + var(--touch-stick-size, 96px) + 14px);
  }

  :root:not([data-hud-camera='first-person']) #radio-comms[data-density='touch-portrait'] .rc-portrait,
  :root:not([data-hud-camera='first-person']) #radio-comms[data-density='touch-portrait'] .rc-head,
  :root:not([data-hud-camera='first-person']) #radio-comms[data-density='touch-portrait'] .rc-name,
  :root:not([data-hud-camera='first-person']) #radio-comms[data-density='touch-portrait'] .rc-signal {
    display: none;
  }

  /*
   * 呼号行（够高的档才显示，见下）：只留呼号；字距收到 0.06em，最长的呼号在 360px 宽的屏上
   * 也放得下，再长就截断
   */
  :root:not([data-hud-camera='first-person']) #radio-comms[data-density='touch-portrait'] .rc-callsign {
    flex: 0 1 auto;
    min-width: 0;
    line-height: 1.3;
    letter-spacing: 0.06em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :root:not([data-hud-camera='first-person']) #radio-comms[data-density='touch-portrait'] .rc-text {
    -webkit-line-clamp: 4;
    line-height: 1.3;
  }

  :root:not([data-hud-camera='first-person']) #radio-comms[data-density='touch-portrait'] .rc-panel {
    padding-top: 3px;
    padding-right: 6px;
    padding-bottom: 3px;
    padding-left: 6px;
  }
}

/* 不到 666px 高（如带着工具栏的手机浏览器）：四行放不下，逐档减到一行 */
@media (orientation: portrait) and (max-width: 699.98px) and (max-height: 665.98px) {
  :root:not([data-hud-camera='first-person']) #radio-comms[data-density='touch-portrait'] .rc-text {
    -webkit-line-clamp: 3;
  }
}

@media (orientation: portrait) and (max-width: 699.98px) and (max-height: 632.98px) {
  :root:not([data-hud-camera='first-person']) #radio-comms[data-density='touch-portrait'] .rc-text {
    -webkit-line-clamp: 2;
  }
}

@media (orientation: portrait) and (max-width: 699.98px) and (max-height: 598.98px) {
  :root:not([data-hud-camera='first-person']) #radio-comms[data-density='touch-portrait'] .rc-text {
    -webkit-line-clamp: 1;
  }
}

/* 够高的档多放几行；从六行起有地方显示呼号行（呼号用说话方的强调色，不显示军衔姓名和信号格） */
@media (orientation: portrait) and (max-width: 699.98px) and (min-height: 728px) {
  :root:not([data-hud-camera='first-person']) #radio-comms[data-density='touch-portrait'] .rc-text {
    -webkit-line-clamp: 5;
  }
}

@media (orientation: portrait) and (max-width: 699.98px) and (min-height: 799px) {
  :root:not([data-hud-camera='first-person']) #radio-comms[data-density='touch-portrait'] .rc-head {
    display: flex;
  }

  :root:not([data-hud-camera='first-person']) #radio-comms[data-density='touch-portrait'] .rc-text {
    -webkit-line-clamp: 6;
  }
}

@media (orientation: portrait) and (max-width: 699.98px) and (min-height: 833px) {
  :root:not([data-hud-camera='first-person']) #radio-comms[data-density='touch-portrait'] .rc-text {
    -webkit-line-clamp: 7;
  }
}

@media (orientation: portrait) and (max-width: 699.98px) and (min-height: 867px) {
  :root:not([data-hud-camera='first-person']) #radio-comms[data-density='touch-portrait'] .rc-text {
    -webkit-line-clamp: 8;
  }
}

/*
 * 手机横握：面板贴在屏幕底边，告警通道的第二行下沿离底边只剩约 50px（底部有安全区的 iPhone 上
 * 扣掉安全区只剩约 31px）。通道同时显示两行（导弹告警 + 闪烁告警，HUD 在 <html> 上记
 * data-hud-warning-rows='2'）时面板收成一行正文，不显示头像和呼号行，内边距和行高收紧；
 * 告警一收起就恢复（平板横屏的告警通道离面板很远，不需要）
 */
@media (orientation: landscape) and (max-height: 699.98px) {
  :root[data-hud-warning-rows='2'] #radio-comms[data-density='touch-landscape'] .rc-portrait,
  :root[data-hud-warning-rows='2'] #radio-comms[data-density='touch-landscape'] .rc-head {
    display: none;
  }

  :root[data-hud-warning-rows='2'] #radio-comms[data-density='touch-landscape'] .rc-text {
    -webkit-line-clamp: 1;
    line-height: 1.3;
  }

  :root[data-hud-warning-rows='2'] #radio-comms[data-density='touch-landscape'] .rc-panel {
    padding-top: 1px;
    padding-bottom: 1px;
  }
}

/* 矮一些的手机（如 800×360）：第二行下沿离底边只剩约 37px，收小的面板再往底边靠 6px */
@media (orientation: landscape) and (max-height: 379.98px) {
  :root[data-hud-warning-rows='2'] #radio-comms[data-density='touch-landscape'] {
    bottom: max(6px, env(safe-area-inset-bottom));
  }
}

/*
 * 平板（index.html 的平板档）：摇杆 / 按键簇从两侧收进 28px + 安全区，并整体抬高 10% 屏高。
 * - 横屏：面板左右缘按这组边距避让（手机档的 20px 会让面板离摇杆、按键簇只剩 6px）。
 * - 竖屏追尾视角：按键簇上方那一带被抬高的按键簇和告警通道占着，面板改放到按键簇左侧、
 *   静止摇杆的上方。
 */
@media (min-width: 700px) and (min-height: 700px) {
  #radio-comms[data-density='touch-landscape'] {
    left: calc(28px + env(safe-area-inset-left, 0px) + var(--touch-stick-size, 150px) + 14px);
    right: calc(28px + env(safe-area-inset-right, 0px) + var(--touch-deck-w, 334.8px) + 14px);
  }

  :root:not([data-hud-camera='first-person']) #radio-comms[data-density='touch-portrait'] {
    left: calc(28px + env(safe-area-inset-left, 0px));
    right: calc(28px + env(safe-area-inset-right, 0px) + var(--touch-deck-w, 334.8px) + 14px);
    bottom: calc(
      max(10vh, calc(env(safe-area-inset-bottom, 0px) + 20px)) + var(--touch-stick-size, 150px) +
        14px
    );
  }
}

#radio-comms:not([data-density='desktop']) .rc-panel {
  gap: 10px;
  padding: 7px 10px 8px 8px;
}

#radio-comms:not([data-density='desktop']) .rc-portrait {
  width: 32px;
  height: 32px;
}

#radio-comms:not([data-density='desktop']) .rc-portrait svg {
  width: 18px;
  height: 18px;
}

#radio-comms:not([data-density='desktop']) .rc-callsign {
  font-size: 12px;
}

#radio-comms:not([data-density='desktop']) .rc-text {
  font-size: 13px;
  line-height: 1.45;
}

@media (prefers-reduced-motion: reduce) {
  #radio-comms .rc-panel,
  #radio-comms .rc-signal i,
  #radio-comms[data-speaker='oracle'] .rc-text {
    animation: none;
  }
}
`;

export function injectRadioStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(RADIO_STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = RADIO_STYLE_ID;
  style.textContent = RADIO_CSS;
  document.head.appendChild(style);
}
