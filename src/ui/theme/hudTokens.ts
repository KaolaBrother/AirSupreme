import { GameConfig } from '@/config';
import {
  HUD_COLORS,
  HUD_SERIF_STACK,
  HUD_SERIF_STACK_ZH,
  type HudLayoutDensity,
} from './hudPalette';

export {
  HUD_COLORS,
  HUD_LAYERS,
  HUD_SERIF_STACK,
  HUD_SERIF_STACK_ZH,
  HUD_TONE_COLORS,
  getHudToneColor,
  prefersReducedMotion,
  readHudLayoutDensity,
  type HudLayoutDensity,
  type HudTone,
} from './hudPalette';

export type LockOnState = 'search' | 'track' | 'lock' | 'break' | 'dry';

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

:root:lang(zh) {
  --hud-serif: ${HUD_SERIF_STACK_ZH};
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
