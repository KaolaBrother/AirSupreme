import { unlockAudioFromUserGesture } from './core/Audio/AudioContextHost';
import { getLogger } from './core/utils/Logger';
import { configLoader } from './core/utils/ConfigLoader';
import type { GameCoordinator } from './core/GameCoordinator';
import { loadStartFlowSettings } from './core/SessionSettings';
import type { CampaignSaveData } from './core/save/SaveSystem';
import { MenuMusic } from './core/campaign/MenuMusic';
import { onLocaleChange, setLocale, tr } from './i18n';
import { StartMenu, type GameSettings } from './ui/StartMenu';

const log = getLogger('Main');

function setShellText(selector: string, text: string): void {
  const element = document.querySelector<HTMLElement>(selector);
  if (element && element.textContent !== text) {
    element.textContent = text;
  }
}

function setShellLabel(selector: string, label: string): void {
  const element = document.querySelector<HTMLElement>(selector);
  if (element && element.getAttribute('aria-label') !== label) {
    element.setAttribute('aria-label', label);
  }
}

/**
 * index.html 的静态文案（页面标题、加载画面、触控按键）按当前语言刷新。
 * index.html 里写的是英文默认值；特武键的武器代号与各键角标由 HUD 接管，这里不写。
 */
function localizeShell(): void {
  document.title = tr({ en: 'Air Supreme - 3D Air Combat', zh: 'Air Supreme - 3D 空战游戏' });
  setShellText('#loading-screen .loading-sub', tr({ en: 'The Skydome War', zh: '天穹之战' }));
  setShellText('#loading-screen .loading-status', tr({ en: 'Loading…', zh: '加载中...' }));

  setShellText('#fire-button', tr({ en: 'FIRE', zh: '开火' }));
  setShellText('#missile-button', tr({ en: 'MSL', zh: '导弹' }));
  setShellText('#throttle-button', tr({ en: 'BOOST', zh: '加速' }));
  setShellText('#upgrade-button', tr({ en: 'PAUSE', zh: '暂停' }));
  setShellText('#flare-button .tc-main', tr({ en: 'FLARE', zh: '热焰' }));
  setShellText('#cycle-button .tc-main', tr({ en: 'SWAP', zh: '切换' }));
  setShellText('#camera-button .tc-main', tr({ en: 'VIEW', zh: '视角' }));
  // 挂着武器时主标签是武器代号（HUD 写入），只在空挂架时写占位名
  if (!document.getElementById('special-button')?.getAttribute('data-weapon')) {
    setShellText('#special-button .tc-main', tr({ en: 'SPEC', zh: '特武' }));
  }

  setShellLabel('#fire-button', tr({ en: 'Fire guns', zh: '开火' }));
  setShellLabel('#missile-button', tr({ en: 'Fire missile', zh: '发射导弹' }));
  setShellLabel('#throttle-button', tr({ en: 'Boost', zh: '加速' }));
  setShellLabel('#upgrade-button', tr({ en: 'Pause', zh: '暂停' }));
  setShellLabel('#special-button', tr({ en: 'Special weapon', zh: '特殊武器' }));
  setShellLabel('#flare-button', tr({ en: 'Flares', zh: '热焰弹' }));
  setShellLabel('#cycle-button', tr({ en: 'Switch special weapon', zh: '切换特殊武器' }));
  setShellLabel('#camera-button', tr({ en: 'Switch camera view', zh: '切换视角' }));
}

function hideLoadingScreen(): void {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.classList.add('hidden');
  }
}

function renderLoadingMessage(title: string, lines: string[]): void {
  const loadingScreen = document.getElementById('loading-screen');
  if (!loadingScreen) {
    return;
  }

  const box = document.createElement('div');
  box.style.cssText = 'text-align: center; color: white; padding: 0 20px;';
  const heading = document.createElement('h1');
  heading.style.cssText = 'font-size: 32px; margin-bottom: 20px; letter-spacing: 0.06em;';
  heading.textContent = title;
  box.appendChild(heading);
  lines.forEach((line, index) => {
    const paragraph = document.createElement('p');
    paragraph.style.cssText =
      index === 0
        ? 'font-size: 16px; opacity: 0.8;'
        : 'font-size: 14px; margin-top: 20px; opacity: 0.6;';
    paragraph.textContent = line;
    box.appendChild(paragraph);
  });
  loadingScreen.replaceChildren(box);
}

function showEnteringBattlefield(): void {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.classList.remove('hidden');
    renderLoadingMessage(tr({ en: '⏳ Entering the battlefield', zh: '⏳ 正在进入战场' }), [
      tr({ en: 'Starting the game runtime…', zh: '正在初始化游戏运行时...' }),
    ]);
  }
}

function showError(message: string): void {
  renderLoadingMessage(tr({ en: '⚠️ Failed to load', zh: '⚠️ 加载失败' }), [
    message,
    tr({
      en: 'Try reloading the page or using a different browser.',
      zh: '请尝试刷新页面或使用其他浏览器',
    }),
  ]);
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
    void import('./core/GameCoordinator').then(({ GameCoordinator }) => {
      void GameCoordinator.warmRuntimeChunks();
    });
  };

  if (typeof window === 'undefined') {
    preload();
    return;
  }

  if ('requestIdleCallback' in window) {
    (
      window as Window & { requestIdleCallback: (cb: IdleRequestCallback) => number }
    ).requestIdleCallback(() => preload());
    return;
  }

  globalThis.setTimeout(preload, 200);
}

async function main(): Promise<void> {
  // 先确定界面语言（默认英文），之后渲染的一切（包括错误提示）都按它取文案
  setLocale(loadStartFlowSettings().language);
  localizeShell();
  onLocaleChange(() => localizeShell());

  if (!checkWebGL()) {
    showError(tr({ en: 'Your browser does not support WebGL.', zh: '您的浏览器不支持 WebGL' }));
    return;
  }

  try {
    await configLoader.load();
    const startMenu = new StartMenu();
    // 菜单音乐：第一次用户手势后开始，进入战斗淡出，回到菜单恢复
    const menuMusic = new MenuMusic();
    menuMusic.install();
    let game: GameCoordinator | null = null;
    let lastSettings: GameSettings | null = null;

    function disposeGame(): void {
      game?.dispose();
      game = null;
    }

    function onExitToMenu(): void {
      disposeGame();
      startMenu.reloadFromStorage();
      startMenu.show();
      menuMusic.onMenuShown();
    }

    function onRetry(): void {
      if (!lastSettings) {
        return;
      }
      startMenu.hide();
      void bootGame(lastSettings);
    }

    /** 检查点续玩：沿用本机音画设置，难度 / 关卡 / 生命 / 视角取自存档（正常模式） */
    function settingsFromCheckpoint(save: CampaignSaveData): GameSettings {
      const stored = loadStartFlowSettings();
      return {
        ...stored,
        difficulty: save.difficulty,
        gameMode: 'normal',
        startLevel: save.level,
        playerLives: save.lives,
        cameraMode: save.cameraMode,
        testScore: 0,
      };
    }

    function continueFromCheckpoint(save: CampaignSaveData): void {
      startMenu.hide();
      void bootGame(settingsFromCheckpoint(save), save);
    }

    async function bootGame(
      settings: GameSettings,
      resume: CampaignSaveData | null = null
    ): Promise<void> {
      showEnteringBattlefield();
      disposeGame();
      unlockAudioFromUserGesture();
      menuMusic.onMenuHidden();

      try {
        const [{ GameCoordinator }] = await Promise.all([import('./core/GameCoordinator')]);
        void GameCoordinator.warmRuntimeChunks();
        const coordinator = new GameCoordinator({
          showStartMenu: false,
          onRetry,
          onExitToMenu,
          resume,
          onContinueFromCheckpoint: continueFromCheckpoint,
        });
        coordinator.boot(settings);
        game = coordinator;
        lastSettings = settings;
        hideLoadingScreen();
      } catch (error) {
        log.error('Game failed to start:', error);
        showError(
          tr({
            en: 'The game failed to start. See the console for details.',
            zh: '游戏启动失败，请查看控制台了解详情',
          })
        );
      }
    }

    startMenu.setOnStart(async (settings: GameSettings) => {
      startMenu.hide();
      await bootGame(settings);
    });

    // 开始菜单“继续战役”：读取并校验过的检查点
    startMenu.setOnContinue((save) => continueFromCheckpoint(save));

    hideLoadingScreen();
    warmGameCoordinatorChunk();

    log.info('🎮 Air Supreme - 3D air combat (v2)');
    log.info('📖 Controls:');
    log.info('  W/S - pitch (nose up / down)');
    log.info('  A/D - yaw (nose left / right)');
    log.info('  Q/E - roll (bank the wings)');
    log.info('  Space - fire');
    log.info('  M - missile');
    log.info('  Shift - boost');
    log.info('📱 Mobile: virtual stick and buttons');

    window.addEventListener('beforeunload', () => {
      game?.dispose();
    });
  } catch (error) {
    log.error('Game initialization failed:', error);
    showError(
      tr({
        en: 'The game failed to initialize. See the console for details.',
        zh: '游戏初始化失败，请查看控制台了解详情',
      })
    );
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => main());
} else {
  main();
}
