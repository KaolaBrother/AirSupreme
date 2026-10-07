/**
 * 航电 HUD 纯数据色板与无依赖的小工具。
 *
 * 不导入 @/config（它在模块加载时读取 navigator / window），因此剧情覆盖层、无线电等
 * 新模块可以在没有 DOM 的环境里被导入和测试。hudTokens 会重新导出这里的全部内容。
 */

export type HudLayoutDensity = 'desktop' | 'touch-landscape' | 'touch-portrait';

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

/**
 * 覆盖层叠放顺序：HUD 50 < 无线电 55 < 移动端控件 100 < 结算 120 < 剧情卡片 150 < 暂停菜单 200
 */
export const HUD_LAYERS = {
  hud: 50,
  radio: 55,
  story: 150,
} as const;

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

function isDensity(value: string | null | undefined): value is HudLayoutDensity {
  return value === 'desktop' || value === 'touch-landscape' || value === 'touch-portrait';
}

/**
 * 读取当前布局密度：优先沿用 HUD（#hud[data-layout-density]）的判定，保证各面板一致；
 * HUD 未挂载时按触控能力与横竖屏推断。没有 DOM 时返回 desktop。
 */
export function readHudLayoutDensity(): HudLayoutDensity {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return 'desktop';
  }
  const fromHud = document.getElementById('hud')?.getAttribute('data-layout-density');
  if (isDensity(fromHud)) {
    return fromHud;
  }
  const touch =
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
    window.ontouchstart != null;
  if (!touch) {
    return 'desktop';
  }
  return window.innerWidth > window.innerHeight ? 'touch-landscape' : 'touch-portrait';
}
