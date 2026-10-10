import { HUD_COLORS, HUD_SERIF_STACK } from '@/ui/theme/hudTokens';

/**
 * 标题画面的容器选择器。下面几段“共用片段”（暂停菜单也用）里的选择器都以它开头，
 * 换到别的容器下用时由 rescopeMenuCss 整体替换。
 */
const MENU_SCOPE = '#start-menu';

/** 共用片段：颜色 / 字体变量 */
const TOKEN_CSS = `
#start-menu {
  --tm-ice: var(--hud-sys, ${HUD_COLORS.sys});
  --tm-amber: var(--hud-weapon, ${HUD_COLORS.weapon});
  --tm-green: var(--hud-lock, ${HUD_COLORS.lock});
  --tm-red: var(--hud-threat, ${HUD_COLORS.threat});
  --tm-text: var(--hud-text, ${HUD_COLORS.text});
  --tm-muted: var(--hud-muted, ${HUD_COLORS.muted});
  --tm-ink: #05131f;
  --tm-font: var(--hud-font, 'Arial', sans-serif);
  --tm-mono: var(--hud-mono, 'Consolas', 'Arial Black', monospace);
  --tm-serif: var(--hud-serif, ${HUD_SERIF_STACK});
  /*
   * 标志字：Arial Black；没有这款字体的系统（iOS / iPadOS / Android）退到系统界面字体的最粗一档。
   * 用到它的地方同时写 font-stretch: 115%：系统字体有宽度轴时（苹果的 SF）取加宽的那一档，
   * 字宽就和 Arial Black 接近（SUPREME 约为字号的 5.35 倍，Arial Black 是 5.45 倍）；
   * Arial Black 自己没有宽度变体，不受影响。
   */
  --tm-display: 'Arial Black', system-ui, 'Arial', sans-serif;
  --tm-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  /* 面板底色：深海军蓝，顶部一抹冰蓝 */
  --tm-panel:
    linear-gradient(180deg, rgba(143, 228, 255, 0.07) 0%, rgba(143, 228, 255, 0) 180px),
    linear-gradient(180deg, rgba(9, 18, 32, 0.97) 0%, rgba(5, 11, 21, 0.97) 100%);
}
`;

/** 共用片段：盒模型、按钮重置、图标、焦点环 */
const BASE_CSS = `
#start-menu,
#start-menu *,
#start-menu *::before,
#start-menu *::after {
  box-sizing: border-box;
}

#start-menu button {
  margin: 0;
  font-family: inherit;
  -webkit-appearance: none;
  appearance: none;
  touch-action: manipulation;
}

#start-menu .mi {
  display: inline-flex;
  flex: none;
  width: 1em;
  height: 1em;
  font-size: 22px;
  line-height: 1;
}

#start-menu .mi svg {
  width: 100%;
  height: 100%;
  display: block;
}

#start-menu :focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 3px;
}
`;

/** 共用片段：切角的主按钮 */
const PRIMARY_CSS = `
/* 主按钮：切角的亮色实块（切角画在 ::before 上，按钮自身不裁剪，焦点环与投影都完整） */
#start-menu .tm-primary {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 78px;
  padding: 12px 16px 12px 16px;
  border: 0;
  background: none;
  color: var(--tm-ink);
  text-align: left;
  cursor: pointer;
  filter: drop-shadow(0 12px 22px rgba(0, 0, 0, 0.42)) drop-shadow(0 0 16px rgba(143, 228, 255, 0.3));
  transition: transform 0.16s var(--tm-ease), filter 0.2s ease;
}

#start-menu .tm-primary::before,
#start-menu .tm-primary::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  clip-path: polygon(
    0 0,
    calc(100% - 18px) 0,
    100% 18px,
    100% 100%,
    18px 100%,
    0 calc(100% - 18px)
  );
}

#start-menu .tm-primary::before {
  background: linear-gradient(180deg, #dcf7ff 0%, #9fe8ff 46%, #72d0f1 100%);
}

/* 每隔几秒扫过一次的高光 */
#start-menu .tm-primary::after {
  background: linear-gradient(
    105deg,
    rgba(255, 255, 255, 0) 42%,
    rgba(255, 255, 255, 0.8) 50%,
    rgba(255, 255, 255, 0) 58%
  ) 140% 0 / 260% 100% no-repeat;
  animation: tm-sheen 6.5s ease-in-out 1.6s infinite;
}

@keyframes tm-sheen {
  0% { background-position: 140% 0; }
  22% { background-position: -40% 0; }
  100% { background-position: -40% 0; }
}

#start-menu .tm-primary-icon {
  width: 44px;
  height: 44px;
  padding: 11px;
  font-size: 22px;
  color: #a6ebff;
  background: var(--tm-ink);
  clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px));
}

#start-menu .tm-primary-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

#start-menu .tm-primary-label {
  font-size: 19px;
  font-weight: 800;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  line-height: 1.15;
}

#start-menu .tm-primary-label:lang(zh) {
  font-size: 21px;
  letter-spacing: 0.3em;
}
`;

/** 共用片段：次级动作行（含主按钮 / 动作行的悬停态） */
const ACTION_CSS = `
#start-menu .tm-go {
  font-size: 22px;
  transition: transform 0.2s var(--tm-ease), opacity 0.18s ease;
}

#start-menu .tm-primary:active {
  transform: scale(0.982);
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.42)) drop-shadow(0 0 26px rgba(143, 228, 255, 0.6))
    brightness(1.08);
}

/* 次级动作：发丝线分隔的文字行 */
#start-menu .tm-secondary {
  display: flex;
  flex-direction: column;
  margin-top: 12px;
}

#start-menu .tm-action {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  height: 54px;
  padding: 0 12px 0 8px;
  border: 0;
  border-bottom: 1px solid rgba(143, 228, 255, 0.17);
  background: none;
  color: rgba(238, 248, 255, 0.9);
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  transition: color 0.16s ease;
}

#start-menu .tm-action::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    rgba(143, 228, 255, 0.24),
    rgba(143, 228, 255, 0.06) 55%,
    rgba(143, 228, 255, 0)
  );
  opacity: 0;
  transform: translate3d(-10%, 0, 0);
  transition: opacity 0.18s ease, transform 0.24s var(--tm-ease);
}

#start-menu .tm-action::after {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 3px;
  height: 24px;
  margin-top: -12px;
  background: var(--tm-ice);
  box-shadow: 0 0 10px rgba(143, 228, 255, 0.85);
  transform: scaleY(0);
  transition: transform 0.18s var(--tm-ease);
}

#start-menu .tm-action-inner {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  transition: transform 0.22s var(--tm-ease);
}

#start-menu .tm-action-icon {
  font-size: 21px;
  color: var(--tm-ice);
}

#start-menu .tm-action-label {
  font-size: 15.5px;
  font-weight: 700;
  letter-spacing: 0.17em;
  text-transform: uppercase;
  white-space: nowrap;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.55);
}

#start-menu .tm-action-label:lang(zh) {
  font-size: 17px;
  letter-spacing: 0.32em;
}

#start-menu .tm-action-note {
  padding: 2px 7px;
  border: 1px solid rgba(255, 179, 71, 0.55);
  border-radius: 2px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--tm-amber);
  white-space: nowrap;
}

#start-menu .tm-action .tm-go {
  position: relative;
  font-size: 18px;
  color: var(--tm-ice);
  opacity: 0;
  transform: translate3d(-8px, 0, 0);
}

#start-menu .tm-action:focus-visible {
  color: #ffffff;
}

#start-menu .tm-action:focus-visible::before,
#start-menu .tm-action:active::before {
  opacity: 1;
  transform: none;
}

#start-menu .tm-action:focus-visible::after,
#start-menu .tm-action:active::after {
  transform: scaleY(1);
}

#start-menu .tm-action:focus-visible .tm-action-inner {
  transform: translate3d(10px, 0, 0);
}

#start-menu .tm-action:focus-visible .tm-go {
  opacity: 1;
  transform: none;
}

#start-menu .tm-action:active .tm-action-inner {
  transform: translate3d(14px, 0, 0);
}

#start-menu .tm-action:disabled {
  cursor: progress;
  color: var(--tm-muted);
}

/* 悬停只在真的有悬停能力的指针上生效（触屏点按后不会“粘”在悬停态） */
@media (hover: hover) {
  #start-menu .tm-primary:hover {
    transform: translate3d(4px, 0, 0);
    filter: drop-shadow(0 12px 22px rgba(0, 0, 0, 0.42)) drop-shadow(0 0 26px rgba(143, 228, 255, 0.55));
  }

  #start-menu .tm-primary:hover .tm-go {
    transform: translate3d(5px, 0, 0);
  }

  #start-menu .tm-primary:hover:active {
    transform: scale(0.982);
  }

  #start-menu .tm-action:hover:not(:disabled) {
    color: #ffffff;
  }

  #start-menu .tm-action:hover:not(:disabled)::before {
    opacity: 1;
    transform: none;
  }

  #start-menu .tm-action:hover:not(:disabled)::after {
    transform: scaleY(1);
  }

  #start-menu .tm-action:hover:not(:disabled) .tm-action-inner {
    transform: translate3d(10px, 0, 0);
  }

  #start-menu .tm-action:hover:not(:disabled) .tm-go {
    opacity: 1;
    transform: none;
  }
}
`;

/** 共用片段：减少动态效果 */
const REDUCED_MOTION_CSS = `
/* ================================================================ 减少动态效果 */
#start-menu.is-reduced *,
#start-menu.is-reduced *::before,
#start-menu.is-reduced *::after,
#start-menu.is-reduced {
  animation: none !important;
  transition: none !important;
}

@media (prefers-reduced-motion: reduce) {
  #start-menu,
  #start-menu *,
  #start-menu *::before,
  #start-menu *::after {
    animation: none !important;
    transition: none !important;
  }
}
`;

/**
 * 把一段菜单样式换到别的容器下：替换容器选择器，并去掉注释——注释只给读源码的人看，
 * 而容器里 <style> 的文字会算进容器的 textContent。
 */
export function rescopeMenuCss(css: string, scope: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(MENU_SCOPE)
    .join(scope);
}

/** 标题画面之外也用的部分（选择器仍以 #start-menu 开头）：变量、基础重置、主按钮、动作行 */
export function menuKitCss(): string {
  return TOKEN_CSS + BASE_CSS + PRIMARY_CSS + ACTION_CSS + REDUCED_MOTION_CSS;
}

/**
 * 标题画面样式：背景层（天空 / 云 / 航电点缀）、标志、动作列表、入场与出场动画。
 * 面板与设置控件的样式在 sheetStyles.ts。
 *
 * 版式：横屏时标志与动作在左栏，主机在右；竖屏时标志在上、动作在下（拇指区），主机居中；
 * 矮横屏（手机横握）压缩字号，次级动作排成两列。
 * 动画只用 transform / opacity；.is-reduced（或系统的“减少动态效果”）下全部关掉。
 */
export const MENU_CSS = `
${TOKEN_CSS}
#start-menu {
  /* 地平线高度与太阳的横向位置（云带、光晕都以它们为基准） */
  --tm-hz: 62%;
  --tm-sun-x: 71%;
  --tm-gutter: clamp(28px, 6vw, 116px);
  /* SUPREME 的宽度约为字号的 5.45 倍：字号上限 × 5.45 必须放得进左栏（各断点同理） */
  --tm-col: clamp(330px, 36vw, 640px);
  --tm-logo-size: clamp(40px, min(6.5vw, 12.5vh), 112px);
  --tm-px: 0;
  --tm-py: 0;
  position: fixed;
  inset: 0;
  z-index: 1000;
  overflow: hidden;
  background: #050b16;
  color: var(--tm-text);
  font-family: var(--tm-font);
  -webkit-tap-highlight-color: transparent;
  -webkit-user-select: none;
  user-select: none;
  touch-action: manipulation;
}

${BASE_CSS}

/* ================================================================ 背景层 */
#start-menu .tm-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

/* 远景与近景各一组，做同一个缓慢的“镜头漂移”；3D 主机的画布夹在两组之间，不参与缩放 */
#start-menu .tm-scene {
  position: absolute;
  inset: -2.5%;
  animation: tm-drift 44s ease-in-out infinite alternate;
  will-change: transform;
}

@keyframes tm-drift {
  from { transform: scale(1) translate3d(-0.7%, 0.35%, 0); }
  to { transform: scale(1.035) translate3d(0.7%, -0.5%, 0); }
}

#start-menu .tm-sky {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(
      ellipse 85% 58% at var(--tm-sun-x) var(--tm-hz),
      rgba(255, 178, 112, 0.5) 0%,
      rgba(244, 128, 94, 0.26) 26%,
      rgba(132, 92, 146, 0.12) 50%,
      rgba(0, 0, 0, 0) 72%
    ),
    linear-gradient(
      180deg,
      #030812 0%,
      #06142c calc(var(--tm-hz) * 0.34),
      #0c2c54 calc(var(--tm-hz) * 0.62),
      #1c5482 calc(var(--tm-hz) * 0.84),
      #4f8cae calc(var(--tm-hz) * 0.95),
      #d7b192 var(--tm-hz),
      #33466a calc(var(--tm-hz) + 3%),
      #142238 calc(var(--tm-hz) + 16%),
      #070d19 100%
    );
}

#start-menu .tm-stars {
  position: absolute;
  left: 0;
  top: 0;
  width: 1px;
  height: 1px;
  border-radius: 50%;
  animation: tm-twinkle 5.5s ease-in-out infinite alternate;
}

#start-menu .tm-stars-b {
  animation-duration: 7.5s;
  animation-delay: -3s;
}

@keyframes tm-twinkle {
  from { opacity: 0.35; }
  to { opacity: 1; }
}

#start-menu .tm-sun {
  position: absolute;
  left: var(--tm-sun-x);
  top: var(--tm-hz);
  width: 124vmin;
  height: 124vmin;
  margin: -62vmin 0 0 -62vmin;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(255, 247, 228, 1) 0%,
    rgba(255, 224, 174, 0.95) 2.2%,
    rgba(255, 188, 118, 0.6) 7%,
    rgba(255, 152, 92, 0.26) 18%,
    rgba(255, 122, 82, 0.08) 36%,
    rgba(255, 122, 82, 0) 56%
  );
  animation: tm-sun 9s ease-in-out infinite alternate;
}

@keyframes tm-sun {
  from { transform: scale(1); opacity: 0.9; }
  to { transform: scale(1.06); opacity: 1; }
}

/* 贴着地平线的一道横向光带 */
#start-menu .tm-flare {
  position: absolute;
  left: var(--tm-sun-x);
  top: var(--tm-hz);
  width: 170vmax;
  height: 7vh;
  margin: -3.5vh 0 0 -85vmax;
  background: radial-gradient(
    ellipse at center,
    rgba(255, 234, 200, 0.72) 0%,
    rgba(255, 192, 134, 0.3) 22%,
    rgba(255, 162, 112, 0) 60%
  );
}

#start-menu .tm-haze {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(var(--tm-hz) - 6%);
  height: 17%;
  background: linear-gradient(
    180deg,
    rgba(255, 206, 162, 0) 0%,
    rgba(255, 200, 152, 0.3) 40%,
    rgba(214, 174, 176, 0.2) 60%,
    rgba(122, 142, 182, 0) 100%
  );
}

/* 云带：外层负责位置与指针视差，内层 track 是两份贴图首尾相接、匀速平移 */
#start-menu .tm-band {
  position: absolute;
  left: 0;
  right: 0;
  overflow: hidden;
  transition: transform 0.35s ease-out;
}

#start-menu .tm-band-track {
  display: flex;
  width: max-content;
  height: 100%;
  animation: tm-scroll 120s linear infinite;
  will-change: transform;
}

#start-menu .tm-band-track canvas {
  display: block;
  flex: none;
  width: max(112vw, 1400px);
  height: 100%;
}

@keyframes tm-scroll {
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(-50%, 0, 0); }
}

#start-menu .tm-band-cirrus {
  top: 5%;
  height: 27%;
  opacity: 0.6;
  transform: translate3d(calc(var(--tm-px) * -4px), calc(var(--tm-py) * -2px), 0);
}

#start-menu .tm-band-cirrus .tm-band-track { animation-duration: 280s; }

#start-menu .tm-band-far {
  top: calc(var(--tm-hz) - 6.5%);
  height: 15%;
  opacity: 0.92;
  transform: translate3d(calc(var(--tm-px) * -7px), calc(var(--tm-py) * -3px), 0);
}

#start-menu .tm-band-far .tm-band-track { animation-duration: 210s; }

#start-menu .tm-band-mid {
  top: calc(var(--tm-hz) + 1.5%);
  height: 31%;
  transform: translate3d(calc(var(--tm-px) * -14px), calc(var(--tm-py) * -6px), 0);
}

#start-menu .tm-band-mid .tm-band-track { animation-duration: 118s; }

#start-menu .tm-band-near {
  left: -2%;
  right: -2%;
  bottom: -4%;
  height: 31%;
  transform: translate3d(calc(var(--tm-px) * -26px), calc(var(--tm-py) * -10px), 0);
}

#start-menu .tm-band-near .tm-band-track { animation-duration: 62s; }

/* 画布不可用时的兜底：一层柔和的云色渐变 */
#start-menu .tm-band-far:not(.is-painted) {
  background: linear-gradient(180deg, rgba(160, 172, 196, 0) 0%, rgba(120, 138, 170, 0.7) 100%);
}

#start-menu .tm-band-mid:not(.is-painted) {
  background: linear-gradient(180deg, rgba(81, 104, 138, 0) 0%, #2a3d5c 55%, #1c2c47 100%);
}

#start-menu .tm-band-near:not(.is-painted) {
  background: linear-gradient(180deg, rgba(34, 51, 77, 0) 0%, #14213a 50%, #070e1b 100%);
}

/* 3D 主机：首帧画好之前完全透明，之后缓缓淡入 */
#start-menu .tm-hero-slot {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 1.1s ease;
}

#start-menu .tm-hero-slot.is-live {
  opacity: 1;
}

#start-menu .tm-hero-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

/* 偶尔掠过镜头的云絮：没有 3D 主机时也有“在飞”的感觉 */
#start-menu .tm-gust {
  position: absolute;
  left: 100%;
  top: 30%;
  width: 78vmax;
  height: 24vmax;
  border-radius: 50%;
  background: radial-gradient(
    ellipse at center,
    rgba(236, 244, 255, 0.17) 0%,
    rgba(236, 244, 255, 0.07) 40%,
    rgba(236, 244, 255, 0) 70%
  );
  animation: tm-gust 14s linear infinite;
  will-change: transform;
}

#start-menu .tm-gust-b {
  top: 54%;
  height: 17vmax;
  animation-duration: 21s;
  animation-delay: -8s;
}

@keyframes tm-gust {
  0% { transform: translate3d(0, 0, 0); }
  32% { transform: translate3d(calc(-110vw - 80vmax), 5vh, 0); }
  100% { transform: translate3d(calc(-110vw - 80vmax), 5vh, 0); }
}

/* 文字一侧压暗 + 四周暗角 */
#start-menu .tm-shade {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      90deg,
      rgba(3, 8, 17, 0.88) 0%,
      rgba(3, 8, 17, 0.64) 25%,
      rgba(3, 8, 17, 0.2) 49%,
      rgba(3, 8, 17, 0) 63%
    ),
    radial-gradient(ellipse 120% 92% at 60% 45%, rgba(0, 0, 0, 0) 55%, rgba(2, 5, 12, 0.6) 100%);
}

#start-menu .tm-scan {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(143, 228, 255, 0.032) 0,
    rgba(143, 228, 255, 0.032) 1px,
    transparent 1px,
    transparent 3px
  );
}

/* ---------------------------------------------------------------- 航电点缀 */
#start-menu .tm-hud {
  position: absolute;
  inset: 0;
}

#start-menu .tm-corner {
  position: absolute;
  width: 22px;
  height: 22px;
  border: 1px solid rgba(143, 228, 255, 0.46);
}

#start-menu .tm-corner-tl {
  left: max(14px, env(safe-area-inset-left));
  top: max(14px, env(safe-area-inset-top));
  border-right: 0;
  border-bottom: 0;
}

#start-menu .tm-corner-tr {
  right: max(14px, env(safe-area-inset-right));
  top: max(14px, env(safe-area-inset-top));
  border-left: 0;
  border-bottom: 0;
}

#start-menu .tm-corner-bl {
  left: max(14px, env(safe-area-inset-left));
  bottom: max(14px, env(safe-area-inset-bottom));
  border-right: 0;
  border-top: 0;
}

#start-menu .tm-corner-br {
  right: max(14px, env(safe-area-inset-right));
  bottom: max(14px, env(safe-area-inset-bottom));
  border-left: 0;
  border-top: 0;
}

/* 顶部的航向带：刻度缓慢向一侧滚动 */
#start-menu .tm-tape {
  position: absolute;
  top: max(16px, env(safe-area-inset-top));
  left: 50%;
  width: min(40vw, 430px);
  height: 34px;
  margin-left: calc(min(40vw, 430px) / -2);
  overflow: hidden;
  opacity: 0.72;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 24%, #000 76%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 24%, #000 76%, transparent);
}

#start-menu .tm-tape-track {
  display: flex;
  width: max-content;
  animation: tm-scroll 170s linear infinite;
  will-change: transform;
}

#start-menu .tm-tape-tick {
  position: relative;
  flex: none;
  width: 58px;
  padding-top: 13px;
  text-align: center;
  font-family: var(--tm-font);
  font-size: 10px;
  letter-spacing: 0.12em;
  color: rgba(143, 228, 255, 0.5);
}

#start-menu .tm-tape-tick::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  width: 1px;
  height: 6px;
  background: rgba(143, 228, 255, 0.55);
}

#start-menu .tm-tape-tick::after {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 1px;
  height: 3px;
  background: rgba(143, 228, 255, 0.32);
}

#start-menu .tm-tape-tick.is-major {
  color: rgba(214, 244, 255, 0.86);
}

#start-menu .tm-tape-tick.is-major::before {
  height: 10px;
  background: var(--tm-ice);
}

#start-menu .tm-tape-caret {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 0;
  height: 0;
  margin-left: -5px;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 6px solid var(--tm-ice);
}

/* ================================================================ 前景 */
#start-menu .tm-stage {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  grid-template-columns: minmax(0, var(--tm-col));
  grid-template-rows: minmax(0, 1fr) auto auto minmax(0, 1.1fr) auto;
  grid-template-areas:
    '.'
    'brand'
    'actions'
    '.'
    'footer';
  justify-content: start;
  padding:
    max(30px, env(safe-area-inset-top))
    max(var(--tm-gutter), env(safe-area-inset-right))
    max(22px, env(safe-area-inset-bottom))
    max(var(--tm-gutter), env(safe-area-inset-left));
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  touch-action: pan-y;
  transition: opacity 0.26s ease, transform 0.3s var(--tm-ease);
}

/* 面板打开时标题画面退后 */
#start-menu.has-sheet .tm-stage {
  opacity: 0.35;
  transform: scale(0.985);
}

/* ---------------------------------------------------------------- 标志 */
#start-menu .tm-brand {
  grid-area: brand;
  min-width: 0;
  margin-bottom: clamp(18px, 4.6vh, 50px);
}

#start-menu .tm-kicker {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 calc(var(--tm-logo-size) * 0.2);
  font-size: clamp(10px, 1.02vw, 12px);
  font-weight: 700;
  letter-spacing: 0.34em;
  text-transform: uppercase;
  color: var(--tm-ice);
  white-space: nowrap;
}

#start-menu .tm-kicker::before {
  content: '';
  flex: none;
  width: 22px;
  height: 2px;
  background: var(--tm-ice);
  box-shadow: 0 0 8px rgba(143, 228, 255, 0.8);
}

#start-menu .tm-kicker:lang(zh) {
  letter-spacing: 0.28em;
  font-size: clamp(11px, 1.1vw, 13px);
}

#start-menu .tm-logo {
  margin: 0;
  font-family: var(--tm-display);
  font-stretch: 115%;
  font-weight: 900;
  line-height: 0.88;
  text-transform: uppercase;
}

#start-menu .tm-logo-top {
  display: flex;
  align-items: center;
  gap: 0.2em;
  font-size: calc(var(--tm-logo-size) * 0.38);
  letter-spacing: 0.56em;
  color: #f4fbff;
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.5);
}

#start-menu .tm-logo-air {
  display: inline-block;
  transform: skewX(-9deg);
}

/* AIR 右侧延伸出去的一条刻线，末端带一个航路点菱形 */
#start-menu .tm-logo-rule {
  position: relative;
  flex: 1;
  max-width: calc(var(--tm-logo-size) * 3.2);
  height: 2px;
  background: linear-gradient(90deg, var(--tm-ice), rgba(143, 228, 255, 0.12));
  transform-origin: left center;
}

#start-menu .tm-logo-rule::after {
  content: '';
  position: absolute;
  right: -3px;
  top: 50%;
  width: 7px;
  height: 7px;
  margin-top: -3.5px;
  border: 1px solid var(--tm-ice);
  background: rgba(143, 228, 255, 0.4);
  transform: rotate(45deg);
}

/* SUPREME：倾斜的重磅字，上亮下蓝、中间一道“地平线”切口的金属渐变 */
#start-menu .tm-logo-main {
  display: block;
  /* 不设 max-width：渐变只画在盒子里，盒子被压窄时超出的字母会变成透明 */
  width: max-content;
  margin-top: 0.1em;
  padding: 0.04em 0.14em 0.06em 0;
  font-size: var(--tm-logo-size);
  letter-spacing: 0.012em;
  transform: skewX(-9deg);
  transform-origin: left bottom;
  background:
    linear-gradient(
      100deg,
      rgba(255, 255, 255, 0) 42%,
      rgba(255, 255, 255, 0.85) 50%,
      rgba(255, 255, 255, 0) 58%
    ) 130% 0 / 260% 100% no-repeat,
    linear-gradient(
      180deg,
      #ffffff 0%,
      #eaf8ff 34%,
      #a9e2f8 51%,
      #5fb2d6 53.5%,
      #bfeaff 76%,
      #8fe4ff 100%
    );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 3px 0 rgba(2, 8, 16, 0.55)) drop-shadow(0 0 26px rgba(143, 228, 255, 0.3));
  animation: tm-glint 9s ease-in-out 2.4s infinite;
}

@keyframes tm-glint {
  0% { background-position: 130% 0, 0 0; }
  14% { background-position: -30% 0, 0 0; }
  100% { background-position: -30% 0, 0 0; }
}

#start-menu .tm-tagline {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: calc(var(--tm-logo-size) * 0.2) 0 0;
  font-family: var(--tm-serif);
  font-size: clamp(12px, calc(var(--tm-logo-size) * 0.2), 23px);
  font-weight: 700;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: #f1f8ff;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
  white-space: nowrap;
}

#start-menu .tm-tagline::before {
  content: '';
  flex: none;
  width: 8px;
  height: 8px;
  border: 1px solid var(--tm-ice);
  background: rgba(143, 228, 255, 0.5);
  transform: rotate(45deg);
}

#start-menu .tm-tagline::after {
  content: '';
  flex: 1;
  max-width: 130px;
  height: 1px;
  background: linear-gradient(90deg, rgba(143, 228, 255, 0.65), rgba(143, 228, 255, 0));
}

#start-menu .tm-tagline:lang(zh) {
  letter-spacing: 0.62em;
  font-size: clamp(14px, calc(var(--tm-logo-size) * 0.24), 27px);
}

/* ---------------------------------------------------------------- 动作 */
#start-menu .tm-actions {
  grid-area: actions;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

${PRIMARY_CSS}

#start-menu .tm-primary-detail {
  font-size: 13.5px;
  font-weight: 700;
  line-height: 1.3;
  color: #0b3147;
}

#start-menu .tm-primary-meta {
  font-size: 12px;
  line-height: 1.3;
  color: #175471;
}

/* 战役航线：十个航路点 */
#start-menu .tm-route {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 12px;
  margin-top: 3px;
  padding-left: 2px;
}

#start-menu .tm-waypoint {
  flex: none;
  width: 7px;
  height: 7px;
  border: 1px solid rgba(5, 19, 31, 0.42);
  transform: rotate(45deg);
}

#start-menu .tm-waypoint.is-done {
  border-color: var(--tm-ink);
  background: var(--tm-ink);
}

#start-menu .tm-waypoint.is-current {
  width: 9px;
  height: 9px;
  border-color: var(--tm-ink);
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.45);
  animation: tm-waypoint 1.8s ease-in-out infinite;
}

@keyframes tm-waypoint {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}

${ACTION_CSS}

/* ---------------------------------------------------------------- 底部提示 */
#start-menu .tm-footer {
  grid-area: footer;
  display: flex;
  align-items: center;
  min-height: 24px;
  margin-top: 14px;
}

#start-menu .tm-hints {
  display: flex;
  align-items: center;
  gap: 18px;
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(183, 231, 255, 0.62);
}

#start-menu .tm-hint {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

#start-menu .tm-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border: 1px solid rgba(143, 228, 255, 0.4);
  border-radius: 3px;
  font-family: var(--tm-font);
  font-size: 10px;
  letter-spacing: 0.04em;
  color: rgba(214, 244, 255, 0.82);
}

#start-menu .tm-hint-text {
  margin-left: 3px;
}

/* 键盘提示只给能悬停的精确指针（桌面）看 */
@media not ((hover: hover) and (pointer: fine)) {
  #start-menu .tm-hints {
    display: none;
  }
}

/* ================================================================ 入场 / 出场 */
#start-menu.is-entering .tm-backdrop {
  animation: tm-fade 0.5s ease both;
}

#start-menu.is-entering .tm-kicker {
  animation: tm-rise 0.5s var(--tm-ease) 0.06s both;
}

#start-menu.is-entering .tm-logo-top {
  animation: tm-rise 0.5s var(--tm-ease) 0.1s both;
}

#start-menu.is-entering .tm-logo-rule {
  animation: tm-rule 0.7s var(--tm-ease) 0.24s both;
}

#start-menu.is-entering .tm-logo-main {
  animation:
    tm-wipe 0.72s var(--tm-ease) 0.14s both,
    tm-glint 9s ease-in-out 2.4s infinite;
}

#start-menu.is-entering .tm-tagline {
  animation: tm-rise 0.5s var(--tm-ease) 0.3s both;
}

#start-menu.is-entering .tm-primary {
  animation: tm-slide 0.46s var(--tm-ease) 0.34s both;
}

#start-menu.is-entering .tm-action {
  animation: tm-slide 0.42s var(--tm-ease) both;
  animation-delay: calc(0.4s + var(--tm-i, 0) * 0.055s);
}

#start-menu.is-entering .tm-action:nth-child(2) { --tm-i: 1; }
#start-menu.is-entering .tm-action:nth-child(3) { --tm-i: 2; }
#start-menu.is-entering .tm-action:nth-child(4) { --tm-i: 3; }

#start-menu.is-entering .tm-footer,
#start-menu.is-entering .tm-hud {
  animation: tm-fade 0.7s ease 0.6s both;
}

@keyframes tm-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes tm-rise {
  from { opacity: 0; transform: translate3d(0, 10px, 0); }
  to { opacity: 1; transform: none; }
}

#start-menu.is-entering .tm-logo-air {
  transform: skewX(-9deg);
}

@keyframes tm-rule {
  from { transform: scaleX(0); opacity: 0; }
  to { transform: scaleX(1); opacity: 1; }
}

@keyframes tm-wipe {
  from { clip-path: inset(-20% 100% -20% 0); opacity: 0.2; }
  to { clip-path: inset(-20% -10% -20% 0); opacity: 1; }
}

@keyframes tm-slide {
  from { opacity: 0; transform: translate3d(-22px, 0, 0); }
  to { opacity: 1; transform: none; }
}

/* 进入战场：前景收走，整个菜单淡出，露出下面已经在显示的“进入战场”画面 */
#start-menu.is-launching {
  pointer-events: none;
  animation: tm-launch 0.34s ease-in both;
}

#start-menu.is-launching .tm-stage {
  animation: tm-stage-out 0.2s ease-in both;
}

@keyframes tm-launch {
  0% { opacity: 1; }
  40% { opacity: 1; }
  100% { opacity: 0; }
}

@keyframes tm-stage-out {
  from { opacity: 1; transform: none; }
  to { opacity: 0; transform: translate3d(-28px, 0, 0); }
}

/* ================================================================ 竖屏 */
@media (max-aspect-ratio: 1/1) {
  #start-menu {
    --tm-hz: 51%;
    --tm-sun-x: 64%;
    --tm-gutter: clamp(18px, 5vw, 56px);
    --tm-logo-size: clamp(40px, 14.2vw, 98px);
  }

  #start-menu .tm-stage {
    grid-template-columns: minmax(0, min(100%, 560px));
    grid-template-rows: auto minmax(0, 1fr) auto auto;
    grid-template-areas:
      'brand'
      '.'
      'actions'
      'footer';
    justify-content: center;
    padding-top: max(62px, calc(env(safe-area-inset-top) + 46px));
    padding-bottom: max(26px, calc(env(safe-area-inset-bottom) + 12px));
  }

  #start-menu .tm-brand {
    margin-bottom: 0;
  }

  /* 上方（标志）与下方（动作）压暗，中间留给主机 */
  #start-menu .tm-shade {
    background:
      linear-gradient(
        180deg,
        rgba(3, 8, 17, 0.74) 0%,
        rgba(3, 8, 17, 0.2) 25%,
        rgba(3, 8, 17, 0) 42%,
        rgba(3, 8, 17, 0.42) 60%,
        rgba(3, 8, 17, 0.9) 100%
      );
  }
}

/* 手机竖屏：动作行收一点 */
@media (max-aspect-ratio: 1/1) and (max-width: 520px) {
  #start-menu .tm-action {
    height: 50px;
  }

  #start-menu .tm-primary {
    min-height: 72px;
  }

  /* 收紧字距：最长的主按钮文字（Continue Campaign）在 320px 宽的栏里也排成一行 */
  #start-menu .tm-primary-label {
    font-size: 17px;
    letter-spacing: 0.06em;
  }

  #start-menu .tm-primary-label:lang(zh) {
    font-size: 19px;
    letter-spacing: 0.2em;
  }

  #start-menu .tm-tape {
    display: none;
  }

  #start-menu .tm-stage {
    padding-top: max(34px, calc(env(safe-area-inset-top) + 22px));
  }
}

/* ================================================================ 矮横屏（手机横握） */
@media (orientation: landscape) and (max-height: 520px) {
  #start-menu {
    --tm-gutter: clamp(18px, 4.4vw, 44px);
    --tm-col: clamp(300px, 46vw, 430px);
    --tm-logo-size: clamp(30px, 12vh, 54px);
  }

  #start-menu .tm-stage {
    grid-template-rows: minmax(0, 1fr) auto auto minmax(0, 1fr);
    grid-template-areas:
      '.'
      'brand'
      'actions'
      '.';
    padding-top: max(12px, env(safe-area-inset-top));
    padding-bottom: max(12px, env(safe-area-inset-bottom));
  }

  #start-menu .tm-brand {
    margin-bottom: 12px;
  }

  #start-menu .tm-kicker,
  #start-menu .tm-footer,
  #start-menu .tm-tape,
  #start-menu .tm-primary-meta {
    display: none;
  }

  #start-menu .tm-primary {
    min-height: 58px;
    padding-top: 8px;
    padding-bottom: 8px;
  }

  #start-menu .tm-primary-icon {
    width: 38px;
    height: 38px;
    padding: 9px;
  }

  #start-menu .tm-primary-label {
    font-size: 16px;
  }

  #start-menu .tm-secondary {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 14px;
    margin-top: 6px;
  }

  #start-menu .tm-action {
    height: 44px;
  }

  #start-menu .tm-action-label {
    font-size: 13px;
    letter-spacing: 0.12em;
  }

  /* 三个次级动作时最后一个占满一行 */
  #start-menu .tm-action:last-child:nth-child(odd) {
    grid-column: 1 / -1;
  }
}

${REDUCED_MOTION_CSS}
`;
