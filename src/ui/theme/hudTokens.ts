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
