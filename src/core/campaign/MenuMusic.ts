import { unlockAudioFromUserGesture } from '@/core/Audio/AudioContextHost';
import { MusicSystem } from '@/core/Audio/MusicSystem';
import { loadStartFlowSettings } from '@/core/SessionSettings';

/**
 * 开始菜单音乐：浏览器的自动播放策略要求先有用户手势，所以第一次点击 / 触摸 / 按键后才开始播放；
 * 进入战斗时淡出（游戏自己的 MusicSystem 接管），回到菜单时恢复。
 *
 * 菜单的 MusicSystem 在整个页面生命周期内保留：它持有共享 AudioContext 的一个引用，
 * 换局时上下文不会被关闭重建（重建后需要新的手势才能出声）。
 */
export class MenuMusic {
  private music: MusicSystem | null = null;
  private gestureSeen = false;
  private menuVisible = true;
  private installed = false;

  private readonly handleGesture = (): void => {
    if (this.gestureSeen) return;
    this.gestureSeen = true;
    this.removeGestureListeners();
    this.start();
  };

  /** 菜单里调整音量后（设置已写入存储）同步菜单音乐音量 */
  private readonly handleClick = (): void => {
    if (this.music && this.menuVisible) {
      this.music.setVolume(loadStartFlowSettings().musicVolume);
    }
  };

  public install(): void {
    if (this.installed || typeof window === 'undefined') return;
    this.installed = true;
    window.addEventListener('pointerdown', this.handleGesture, true);
    window.addEventListener('keydown', this.handleGesture, true);
    window.addEventListener('touchstart', this.handleGesture, true);
    document.addEventListener('click', this.handleClick);
  }

  /** 开始菜单显示（页面加载后 / 退出到菜单） */
  public onMenuShown(): void {
    this.menuVisible = true;
    this.start();
  }

  /** 进入战斗：菜单音乐淡出 */
  public onMenuHidden(): void {
    this.menuVisible = false;
    this.music?.stopMusic();
  }

  private start(): void {
    if (!this.menuVisible || !this.gestureSeen) return;
    unlockAudioFromUserGesture();
    this.music ??= new MusicSystem();
    this.music.setVolume(loadStartFlowSettings().musicVolume);
    this.music.playMenuMusic();
  }

  private removeGestureListeners(): void {
    window.removeEventListener('pointerdown', this.handleGesture, true);
    window.removeEventListener('keydown', this.handleGesture, true);
    window.removeEventListener('touchstart', this.handleGesture, true);
  }

  public dispose(): void {
    if (this.installed) {
      this.removeGestureListeners();
      document.removeEventListener('click', this.handleClick);
      this.installed = false;
    }
    this.music?.dispose();
    this.music = null;
  }
}
