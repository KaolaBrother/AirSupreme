import { describeCheckpoint, type CampaignSaveData } from '@/core/save/SaveSystem';
import { HUD_COLORS, injectHudTokens } from '@/ui/theme/hudTokens';

/**
 * 结算界面上的“从检查点继续”按钮（MISSION FAILED 且存在战役检查点时显示）。
 * 独立于 HUD 的结算面板，固定在面板下方；点击后隐藏并把检查点交给协调器重新开局。
 */
export class CheckpointResumeButton {
  private button: HTMLButtonElement | null = null;
  private detail: HTMLSpanElement | null = null;
  private pending: CampaignSaveData | null = null;
  private onResume: ((save: CampaignSaveData) => void) | null = null;

  public show(save: CampaignSaveData, onResume: (save: CampaignSaveData) => void): void {
    if (typeof document === 'undefined') {
      return;
    }
    injectHudTokens();
    this.pending = save;
    this.onResume = onResume;
    const button = this.ensureButton();
    if (this.detail) {
      this.detail.textContent = describeCheckpoint(save);
    }
    button.style.display = 'flex';
  }

  public hide(): void {
    if (this.button) {
      this.button.style.display = 'none';
    }
    this.pending = null;
  }

  public dispose(): void {
    this.button?.remove();
    this.button = null;
    this.detail = null;
    this.pending = null;
    this.onResume = null;
  }

  private ensureButton(): HTMLButtonElement {
    if (this.button) {
      return this.button;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'checkpoint-resume-btn';
    button.style.cssText = `
      position: fixed;
      left: 50%;
      bottom: max(9vh, calc(env(safe-area-inset-bottom) + 24px));
      transform: translateX(-50%);
      z-index: 130;
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      min-width: min(360px, calc(100% - 32px));
      min-height: 52px;
      padding: 10px 18px;
      box-sizing: border-box;
      cursor: pointer;
      pointer-events: auto;
      border: 1px solid var(--hud-lock, ${HUD_COLORS.lock});
      border-radius: var(--hud-radius, 12px);
      color: var(--hud-text, ${HUD_COLORS.text});
      background: var(--hud-glass, ${HUD_COLORS.glass});
      box-shadow: 0 0 18px rgba(92, 255, 176, 0.25), var(--hud-shadow, ${HUD_COLORS.shadow});
      backdrop-filter: blur(10px);
      font-family: var(--hud-font, 'Arial', sans-serif);
    `;

    const title = document.createElement('span');
    title.textContent = '从检查点继续';
    title.style.cssText = 'font-size: 16px; font-weight: 700; letter-spacing: 0.08em;';
    const detail = document.createElement('span');
    detail.style.cssText = `font-size: 12px; color: var(--hud-muted, ${HUD_COLORS.muted});`;
    button.appendChild(title);
    button.appendChild(detail);

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const save = this.pending;
      const onResume = this.onResume;
      this.hide();
      if (save && onResume) {
        onResume(save);
      }
    });

    document.body.appendChild(button);
    this.button = button;
    this.detail = detail;
    return button;
  }
}
