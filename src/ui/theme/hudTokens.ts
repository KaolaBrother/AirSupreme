import { GameConfig } from '@/config';

export type HudLayoutDensity = 'desktop' | 'touch-landscape' | 'touch-portrait';

export type LockOnState = 'search' | 'track' | 'lock' | 'break' | 'dry';

/** 航电 HUD 色板（canvas / SVG 与 CSS 变量共用） */
export const HUD_COLORS = {
  sys: '#8FE4FF',
  weapon: '#FFB347',
  lock: '#5CFFB0',
  lockRgb: 'rgb(92, 255, 176)',
  threat: '#FF4D4D',
  ally: '#F4D35E',
  glass: 'rgba(8,14,24,0.72)',
  edge: 'rgba(143,228,255,0.28)',
  text: '#EEF8FF',
  muted: 'rgba(183,231,255,0.86)',
  shadow: '0 12px 24px rgba(0, 0, 0, 0.28)',
} as const;

/** 叙事文本（章节卡、结算总结、结局）使用的衬线字体栈，CJK 优先 */
export const HUD_SERIF_STACK =
  "'Noto Serif SC', 'Noto Serif CJK SC', 'Source Han Serif SC', 'Songti SC', 'STSong', 'SimSun', serif";

/** 语义色调：与 CampaignSpeakerTone 兼容（sys / ally / threat / weapon / muted） */
export type HudTone = 'sys' | 'weapon' | 'lock' | 'threat' | 'ally' | 'muted';

export const HUD_TONE_COLORS: Readonly<Record<HudTone, string>> = {
  sys: HUD_COLORS.sys,
  weapon: HUD_COLORS.weapon,
  lock: HUD_COLORS.lock,
  threat: HUD_COLORS.threat,
  ally: HUD_COLORS.ally,
  muted: '#C3CCD6',
};

/** 未知色调回退到 sys，避免运行时数据把颜色写成 undefined */
export function getHudToneColor(tone: string): string {
  return tone in HUD_TONE_COLORS ? HUD_TONE_COLORS[tone as HudTone] : HUD_COLORS.sys;
}

export const HUD_TOKEN_STYLE_ID = 'hud-tokens';

const HUD_TOKEN_CSS = `
:root {
  --hud-sys: ${HUD_COLORS.sys};
  --hud-weapon: ${HUD_COLORS.weapon};
  --hud-lock: ${HUD_COLORS.lock};
  --hud-threat: ${HUD_COLORS.threat};
  --hud-ally: ${HUD_COLORS.ally};
  --hud-glass: ${HUD_COLORS.glass};
  --hud-edge: ${HUD_COLORS.edge};
  --hud-text: ${HUD_COLORS.text};
  --hud-muted: ${HUD_COLORS.muted};
  --hud-shadow: ${HUD_COLORS.shadow};
  --hud-radius: 12px;
  --hud-font: 'Arial', sans-serif;
  --hud-mono: 'Consolas', 'Arial Black', monospace;
  --hud-serif: ${HUD_SERIF_STACK};
}
`;

/**
 * 将航电 token 注入 :root，仅一次。
 */
export function injectHudTokens(): void {
  if (typeof document === 'undefined') {
    return;
  }
  if (document.getElementById(HUD_TOKEN_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = HUD_TOKEN_STYLE_ID;
  style.textContent = HUD_TOKEN_CSS;
  document.head.appendChild(style);
}

/** 视口坐标下的包围盒（像素） */
export interface HudRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** 右下“挂载物”面板（特殊武器 + 热焰弹）的宽度，按布局密度 */
export const HUD_STORES_WIDTH: Readonly<Record<HudLayoutDensity, number>> = {
  desktop: 228,
  'touch-landscape': 172,
  'touch-portrait': 148,
};

/** 与 HUD 布局协同的元素 ID（无线电面板据此避让） */
export const HUD_STORES_ID = 'hud-stores';

function toHudRect(element: Element | null): HudRect | null {
  if (!element) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

/** 读取元素包围盒；缺失或不可见（零尺寸）时返回 null。仅在布局变化时调用，勿每帧调用。 */
export function measureHudElement(id: string): HudRect | null {
  if (typeof document === 'undefined') {
    return null;
  }
  return toHudRect(document.getElementById(id));
}

/** 触控按钮区（#mobile-controls 内的 .button-container）包围盒；桌面端返回 null */
export function measureTouchDeck(): HudRect | null {
  if (typeof document === 'undefined') {
    return null;
  }
  return toHudRect(document.querySelector('#mobile-controls .button-container'));
}

/** 用户是否请求减少动态效果 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    // matchMedia 在部分测试环境里不可用
    return false;
  }
}

export function detectHudLayoutDensity(): HudLayoutDensity {
  const touch =
    GameConfig.isMobile ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
    (typeof window !== 'undefined' && window.ontouchstart != null);

  if (!touch) {
    return 'desktop';
  }

  return window.innerWidth > window.innerHeight ? 'touch-landscape' : 'touch-portrait';
}
