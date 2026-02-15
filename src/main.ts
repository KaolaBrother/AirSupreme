import { GameCoordinator } from './core/GameCoordinator';

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
  } catch (_e) {
    return false;
  }
}

async function main(): Promise<void> {
  if (!checkWebGL()) {
    showError('您的浏览器不支持 WebGL');
    return;
  }

  try {
    const game = new GameCoordinator();

    hideLoadingScreen();

    console.log('🎮 Air Supreme - 3D 空战游戏 (v2)');
    console.log('📖 控制说明:');
    console.log('  W/S - 俯仰（机头上下）');
    console.log('  A/D - 偏航（机头左右）');
    console.log('  Q/E - 翻滚（机翼倾斜）');
    console.log('  空格 - 开火');
    console.log('  M - 导弹');
    console.log('  Shift - 加速');
    console.log('');
    console.log('📱 移动端: 使用虚拟摇杆和按钮控制');

    window.addEventListener('beforeunload', () => {
      game.dispose();
    });
  } catch (error) {
    console.error('游戏初始化失败:', error);
    showError('游戏初始化失败，请查看控制台了解详情');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => main());
} else {
  main();
}
