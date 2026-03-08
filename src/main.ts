import { getLogger } from './core/utils/Logger';
import { configLoader } from './core/utils/ConfigLoader';
import { StartMenu, type GameSettings } from './ui/StartMenu';

const log = getLogger('Main');

function hideLoadingScreen(): void {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.classList.add('hidden');
  }
}

function showError(message: string): void {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.innerHTML = `
      <div style="text-align: center; color: white;">
        <h1 style="font-size: 32px; margin-bottom: 20px;">⚠️ 加载失败</h1>
        <p style="font-size: 16px; opacity: 0.8;">${message}</p>
        <p style="font-size: 14px; margin-top: 20px; opacity: 0.6;">
          请尝试刷新页面或使用其他浏览器
        </p>
      </div>
    `;
  }
}

function checkWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return gl !== null;
  } catch {
    return false;
  }
}

function warmGameCoordinatorChunk(): void {
  const preload = () => {
    void import('./core/GameCoordinator');
  };

  if (typeof window === 'undefined') {
    preload();
    return;
  }

  if ('requestIdleCallback' in window) {
    (window as Window & { requestIdleCallback: (cb: IdleRequestCallback) => number })
      .requestIdleCallback(() => preload());
    return;
  }

  globalThis.setTimeout(preload, 200);
}

async function main(): Promise<void> {
  if (!checkWebGL()) {
    showError('您的浏览器不支持 WebGL');
    return;
  }

  try {
    await configLoader.load();
    const startMenu = new StartMenu();
    let game: { dispose: () => void } | null = null;

    startMenu.setOnStart(async (settings: GameSettings) => {
      const loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen) {
        loadingScreen.classList.remove('hidden');
        loadingScreen.innerHTML = `
          <div style="text-align: center; color: white;">
            <h1 style="font-size: 32px; margin-bottom: 20px;">⏳ 正在进入战场</h1>
            <p style="font-size: 16px; opacity: 0.8;">正在初始化游戏运行时...</p>
          </div>
        `;
      }

      try {
        const [{ GameCoordinator }] = await Promise.all([import('./core/GameCoordinator')]);
        startMenu.dispose();
        const coordinator = new GameCoordinator({ showStartMenu: false });
        coordinator.boot(settings);
        game = coordinator;
        hideLoadingScreen();
      } catch (error) {
        log.error('游戏启动失败:', error);
        showError('游戏启动失败，请查看控制台了解详情');
      }
    });

    hideLoadingScreen();
    warmGameCoordinatorChunk();

    log.info('🎮 Air Supreme - 3D 空战游戏 (v2)');
    log.info('📖 控制说明:');
    log.info('  W/S - 俯仰（机头上下）');
    log.info('  A/D - 偏航（机头左右）');
    log.info('  Q/E - 翻滚（机翼倾斜）');
    log.info('  空格 - 开火');
    log.info('  M - 导弹');
    log.info('  Shift - 加速');
    log.info('📱 移动端: 使用虚拟摇杆和按钮控制');

    window.addEventListener('beforeunload', () => {
      game?.dispose();
    });
  } catch (error) {
    log.error('游戏初始化失败:', error);
    showError('游戏初始化失败，请查看控制台了解详情');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => main());
} else {
  main();
}
