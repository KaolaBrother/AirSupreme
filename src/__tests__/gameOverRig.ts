import * as THREE from 'three';
import { expect, vi } from 'vitest';
import { EventBus, GameEventType } from '@/core/EventBus';
import { GameSessionState } from '@/core/GameSessionState';
import { GameState } from '@/core/GameState';
import { InputHandler } from '@/core/Input/InputHandler';
import { ResourceRegistry } from '@/core/ResourceRegistry';
import { DEFAULT_START_FLOW_SETTINGS } from '@/core/SessionSettings';
import type { CampaignFlowController } from '@/core/campaign/CampaignFlowController';
import {
  CAMPAIGN_SAVE_KEY,
  saveCampaignCheckpoint,
  type CampaignSaveData,
} from '@/core/save/SaveSystem';
import { BOSS_CONFIGS, getBossForLevel } from '@/features/boss/BossTypes';
import { PlayerStats } from '@/features/upgrade/UpgradeSystem';
import type { LocalizedText } from '@/i18n';
import type { HUD } from '@/ui/HUD';
import type { GameSettings } from '@/ui/StartMenu';

/**
 * 结算面板（任务失败 / 任务完成）测试共用的工具：存档、面板查询、键盘模型，以及一台
 * “协调器台架”。
 *
 * 台架：GameCoordinator 整体依赖 WebGL，jsdom 里建不出来。这里沿用 CoordinatorWiring.test.ts 的
 * 办法——以真实的 GameCoordinator 原型为原型造一个对象，只把重量级的协作者换成替身：
 * - 真实运行的协调器方法：boot / bootWhenReady / ensurePresentationRuntime / applyGameSettings /
 *   setupEventListeners / createCampaignFlow / captureCheckpoint / resolveCheckpointRetry /
 *   showMissionComplete / handleBossDestroy / handlePauseToggle / dispose；
 * - 真实的协作者：GameSessionState、GameState、PlayerStats、ResourceRegistry、InputHandler、
 *   EventBus、CampaignFlowController、SaveSystem，以及表现层运行时（HUD、锁定框、Boss 指示器、
 *   PresentationController，由 ensurePresentationRuntime 自己创建并接线）；
 * - 替身：渲染场景、音频、玩家机体、特殊武器、单位、镜头、战役表现层（剧情卡片 / 无线电）。
 *   startInternal（加载敌机、地形并启动循环）换成只把会话置为“进行中”。
 * 所以“阵亡后面板上是什么、按下去交给宿主什么、开局时存档清不清”都是生产代码决定的。
 */

export type Stub = Record<string, unknown>;

/** 任意方法都是 vi.fn() 的替身；overrides 里给了的用给的 */
export function stubWith(overrides: Stub = {}): Stub {
  const methods = new Map<PropertyKey, unknown>();
  return new Proxy(overrides, {
    get: (target, key) => {
      if (key === 'then') return undefined;
      if (key in target) return target[key as string];
      let method = methods.get(key);
      if (!method) {
        method = vi.fn();
        methods.set(key, method);
      }
      return method;
    },
  });
}

// ───────────────────────────── 存档 ─────────────────────────────

export type CheckpointInput = Omit<CampaignSaveData, 'version' | 'savedAt'>;

/** 第 2 关、下一波是第 4 波的检查点：“Ch. 2 · Sandstorm · Wave 4” */
export const WAVE_CHECKPOINT: CheckpointInput = {
  checkpoint: 'wave',
  level: 2,
  wave: 3,
  difficulty: 4,
  score: 8_400,
  lives: 2,
  missiles: 3,
  upgrades: {},
  weapons: { unlocked: ['rockets'], selected: 'rockets', ammo: { rockets: 5 } },
  flares: 1,
  cameraMode: 'first-person',
  stats: { kills: 31, civiliansLost: 0, deaths: 2, playTimeSeconds: 540 },
};

/** 写入一份有效检查点，返回存储里的原始字符串（用来做“逐字节不变”的断言） */
export function seedSave(overrides: Partial<CheckpointInput> = {}): string {
  expect(saveCampaignCheckpoint({ ...WAVE_CHECKPOINT, ...overrides })).toBe(true);
  const raw = window.localStorage.getItem(CAMPAIGN_SAVE_KEY);
  expect(raw, 'the checkpoint was written').not.toBeNull();
  return raw as string;
}

export function rawSave(): string | null {
  return window.localStorage.getItem(CAMPAIGN_SAVE_KEY);
}

/** 整个 localStorage 的快照：检查点之外的键（设置、战役进度）也不该被动到 */
export function storageSnapshot(): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key !== null) snapshot[key] = window.localStorage.getItem(key) ?? '';
  }
  return snapshot;
}

/** 一局的开局设置（默认：正常模式、第 1 关、3 条命） */
export function runSettings(overrides: Partial<GameSettings> = {}): GameSettings {
  return { ...DEFAULT_START_FLOW_SETTINGS, ...overrides };
}

// ───────────────────────────── 结算面板 ─────────────────────────────

export const LABELS = {
  retry: { en: 'Retry from checkpoint', zh: '从检查点重试' },
  playAgain: { en: 'Play Again', zh: '再来一局' },
  mainMenu: { en: 'Main Menu', zh: '返回菜单' },
  failed: { en: 'MISSION FAILED', zh: '任务失败' },
  complete: { en: 'MISSION COMPLETE', zh: '任务完成' },
} satisfies Record<string, LocalizedText>;

/** 两种语言里所有“从头再来”的说法：有检查点的面板上一个都不该出现 */
export const START_OVER_WORDING =
  /play again|再来一局|restart|start over|new (game|campaign)|重新开始|新战役/i;
/** 两种语言里“从检查点重试 / 继续”的说法 */
export const CHECKPOINT_WORDING = /checkpoint|检查点/i;

function isShown(element: Element | null): boolean {
  for (let node = element; node; node = node.parentElement) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.hidden || node.style.display === 'none' || node.hasAttribute('inert')) return false;
  }
  return element !== null && element.isConnected;
}

/** 结算覆盖层此刻盖在画面上（淡入用的是 opacity，不是 display） */
export function isSettlementUp(): boolean {
  const overlay = document.getElementById('hud-settlement-overlay');
  return overlay !== null && isShown(overlay) && overlay.style.opacity === '1';
}

export function settlementPanel(): HTMLElement {
  const panel = document.getElementById('hud-settlement-panel');
  expect(panel, 'expected #hud-settlement-panel in the document').not.toBeNull();
  return panel as HTMLElement;
}

/** 面板动作行里玩家看得见的按钮，按文档顺序 */
export function actionButtons(): HTMLButtonElement[] {
  const row = document.getElementById('hud-settlement-actions');
  expect(row, 'expected #hud-settlement-actions in the document').not.toBeNull();
  return Array.from((row as HTMLElement).querySelectorAll('button')).filter(isShown);
}

/** 文字归一：相邻元素之间补空格，连续空白压成一个 */
export function readText(element: Element | null): string {
  if (!element) return '';
  const parts: string[] = [];
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? '');
    } else if (node instanceof Element && node.tagName !== 'STYLE') {
      node.childNodes.forEach(walk);
    }
  };
  walk(element);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function actionTexts(): string[] {
  return actionButtons().map((button) => readText(button));
}

/** 文档里所有玩家看得见的按钮（面板内外都算） */
export function visibleButtons(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll('button')).filter(isShown);
}

/** 标题（MISSION FAILED / MISSION COMPLETE） */
export function settlementTitle(): string {
  return readText(document.getElementById('game-over-title'));
}

// ───────────────────────────── 键盘模型 ─────────────────────────────

const TABBABLE = 'button, [href], input, select, textarea, [tabindex]';

function tabbables(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (element) =>
      isShown(element) &&
      !(element as HTMLButtonElement).disabled &&
      element.getAttribute('tabindex') !== '-1'
  );
}

function keyCode(key: string): string {
  if (key === ' ') return 'Space';
  return key;
}

function dispatchKey(
  type: 'keydown' | 'keyup',
  key: string,
  init: KeyboardEventInit = {}
): KeyboardEvent {
  const event = new KeyboardEvent(type, {
    key,
    code: keyCode(key),
    bubbles: true,
    cancelable: true,
    ...init,
  });
  (document.activeElement ?? document.body).dispatchEvent(event);
  return event;
}

/**
 * 按一下 Tab。jsdom 不做顺序焦点导航，这里补上浏览器的默认动作：keydown 没被 preventDefault
 * 时，焦点移到文档顺序里的下一个可聚焦元素（Shift 反向，到头回绕）。返回焦点有没有移动。
 */
export function pressTab(init: { shiftKey?: boolean } = {}): boolean {
  const before = document.activeElement;
  const down = dispatchKey('keydown', 'Tab', init);
  if (!down.defaultPrevented) {
    const order = tabbables();
    if (order.length > 0) {
      const index = order.indexOf(before as HTMLElement);
      const step = init.shiftKey ? -1 : 1;
      const start = index === -1 ? (init.shiftKey ? 0 : -1) : index;
      order[(start + step + order.length) % order.length].focus();
    }
  }
  dispatchKey('keyup', 'Tab', init);
  return document.activeElement !== before;
}

/**
 * Enter / Space 对按钮的默认动作。jsdom 不会把按键变成 click，这里按浏览器的做法补上：
 * - Enter：每个没被 preventDefault 的 keydown（含按住不放的自动重复）都激活一次；
 * - Space：没被 preventDefault 的 keydown（含自动重复）把焦点所在的按钮“按下”，
 *   keyup 落在同一个按钮上时才激活。
 */
let spaceArmedOn: Element | null = null;

/** 按下一个键不放（repeat：系统的自动重复） */
export function keyDown(key: 'Enter' | ' ', init: { repeat?: boolean } = {}): KeyboardEvent {
  const target = document.activeElement;
  const down = dispatchKey('keydown', key, { repeat: init.repeat === true });
  if (!down.defaultPrevented && target instanceof HTMLButtonElement) {
    if (key === 'Enter') {
      target.click();
    } else {
      spaceArmedOn = target;
    }
  }
  return down;
}

/** 松开这个键 */
export function keyUp(key: 'Enter' | ' '): void {
  const target = document.activeElement;
  const up = dispatchKey('keyup', key);
  if (key !== ' ') {
    return;
  }
  const armed = spaceArmedOn;
  spaceArmedOn = null;
  if (armed !== null && armed === target && !up.defaultPrevented) {
    (armed as HTMLButtonElement).click();
  }
}

/** 在当前焦点上按一下（按下再松开）Enter 或 Space */
export function pressActivationKey(key: 'Enter' | ' '): void {
  keyDown(key);
  keyUp(key);
}

/** 用例之间把“按住的键”清掉 */
export function resetKeyboardModel(): void {
  spaceArmedOn = null;
}

/** 用 Tab 能不能走到这个按钮（最多绕文档一圈） */
export function tabTo(button: HTMLElement): boolean {
  const limit = tabbables().length + 1;
  for (let i = 0; i < limit && document.activeElement !== button; i++) {
    pressTab();
  }
  return document.activeElement === button;
}

// ───────────────────────────── 让出事件循环 ─────────────────────────────

/** 让出若干轮宏任务：按需加载的模块（import()）与其后的微任务跑完 */
export async function flush(rounds: number = 4): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

export async function waitUntil(done: () => boolean, rounds: number = 400): Promise<void> {
  for (let i = 0; i < rounds && !done(); i++) {
    await flush(1);
  }
}

// ───────────────────────────── 协调器台架 ─────────────────────────────

/** 宿主（main.ts）交给协调器的选项 */
export interface HostOptions {
  showStartMenu?: boolean;
  onRetry?: () => void;
  onExitToMenu?: () => void;
  resume?: CampaignSaveData | null;
  onContinueFromCheckpoint?: (save: CampaignSaveData) => void;
}

/** 真实的 GameCoordinator 类（只用到它的原型） */
export interface CoordinatorClass {
  prototype: object;
}

export interface CoordinatorRig {
  /** 以真实原型为原型的协调器对象 */
  readonly target: Stub;
  readonly options: HostOptions;
  readonly session: GameSessionState;
  readonly campaign: CampaignFlowController;
  /** 真实的 GameCoordinator.boot(settings)（表现层按需加载，随后才进入对局） */
  boot(settings: GameSettings): void;
  /** boot 之后等到对局开始 */
  playing(): Promise<void>;
  isDisposed(): boolean;
  /** 表现层运行时创建的那个真实 HUD */
  hud(): HUD;
  setScore(score: number): void;
  lives(): number;
  cameraMode(): GameSettings['cameraMode'];
  /** 玩家阵亡（PlayerSystem 扣掉一条命后发出的事件）；livesLeft 为 0 即任务失败 */
  die(livesLeft?: number): void;
  /** 一波打完（关卡管理器发出的事件）：正常模式写下一波的检查点 */
  completeWave(wave: number): void;
  /** 最后一波之后的间隔结束（关卡管理器发出的事件）：正常模式写 Boss 战前检查点 */
  completeLevel(level: number): void;
  /** 击破当前关的 Boss（协调器的 handleBossDestroy）；随后把收尾 / 结算 / 结局走完 */
  destroyBoss(level: number): void;
  /** Esc / P（协调器的 handlePauseToggle） */
  togglePause(): void;
  call<T>(method: string, ...args: unknown[]): T;
  /** 真实的 GameCoordinator.dispose() */
  dispose(): void;
}

function method(Real: CoordinatorClass, name: string): (...args: unknown[]) => unknown {
  const found = (Real.prototype as Record<string, unknown>)[name];
  expect(typeof found, `GameCoordinator.${name}`).toBe('function');
  return found as (...args: unknown[]) => unknown;
}

export function createCoordinatorRig(Real: CoordinatorClass, options: HostOptions): CoordinatorRig {
  let lives = DEFAULT_START_FLOW_SETTINGS.playerLives;
  let cameraMode: GameSettings['cameraMode'] = 'third-person';
  const session = new GameSessionState();
  const gameState = new GameState();

  const target = Object.create(Real.prototype) as Stub;
  Object.assign(target, {
    options,
    showStartMenu: options.showStartMenu ?? false,
    isDisposed: false,
    presentationRuntimeReady: false,
    presentationRuntimePromise: null,
    resourceRegistry: new ResourceRegistry(),
    sessionState: session,
    gameState,
    playerStats: new PlayerStats(),
    inputHandler: new InputHandler(),
    missileCount: 4,
    pauseMenu: null,
    pauseMenuPromise: null,
    upgradeMenu: null,
    upgradeMenuPromise: null,
    playerAircraft: { visible: true, position: new THREE.Vector3(0, 120, 0) },
    playerSystem: stubWith({
      getLives: () => lives,
      setLives: (value: number) => {
        lives = value;
      },
      isShieldActive: () => false,
      getHealth: () => stubWith(),
    }),
    view: stubWith({
      getMode: () => cameraMode,
      setMode: (mode: GameSettings['cameraMode']) => {
        cameraMode = mode;
      },
    }),
    weapons: stubWith({
      exportState: () => ({ unlocked: [], selected: null, ammo: {} }),
      getFlareCharges: () => 0,
    }),
    // 战役表现层：结算 / 结局卡片立即“看完”，无线电不占线
    presentation: stubWith({
      showDebrief: (_data: unknown, next: () => void) => next(),
      showEnding: (_score: number, next: () => void) => next(),
      getRadioBacklogSeconds: () => 0,
      isRadioBusy: () => false,
    }),
    audioManager: stubWith(),
    musicSystem: stubWith(),
    voiceSystem: stubWith(),
    gameScene: stubWith(),
    gameLoop: stubWith(),
    gunLeadSolver: stubWith(),
    vfx: stubWith(),
    units: stubWith(),
    wingmen: stubWith(),
    // 重量级的步骤（加载敌机 / 地形、启动循环）不在这些测试的范围内：只进入对局并建好战斗界面
    startInternal: () => {
      session.setPlaying();
      (target.presentationController as { initializeCombatUi(): void }).initializeCombatUi();
    },
    setQualityPreset: vi.fn(),
    prepareLevel: () => Promise.resolve(),
    startLevelCombat: vi.fn(),
    startBossEncounter: vi.fn(),
    showHangar: vi.fn(),
    syncProgression: vi.fn(),
    setStoryHold: vi.fn(),
    handleTutorialPlayerHit: vi.fn(),
    handleTutorialEnemyDeath: vi.fn(),
    handleWaveEventComplete: vi.fn(),
    handleWaveStartUnits: vi.fn(),
    notifyEarnedUpgradePoints: vi.fn(),
  });

  const call = <T>(name: string, ...args: unknown[]): T =>
    method(Real, name).apply(target, args) as T;

  target.campaign = call<CampaignFlowController>('createCampaignFlow');
  call<void>('setupEventListeners');

  return {
    target,
    options,
    session,
    campaign: target.campaign as CampaignFlowController,
    boot: (settings) => call<void>('boot', settings),
    playing: async () => {
      await waitUntil(() => session.isPlaying());
      expect(session.isPlaying(), 'the run started').toBe(true);
    },
    isDisposed: () => target.isDisposed === true,
    hud: () => {
      expect(target.presentationRuntimeReady, 'the presentation runtime is up').toBe(true);
      return target.hud as HUD;
    },
    setScore: (score) => {
      gameState.reset();
      gameState.addScore(score);
    },
    lives: () => lives,
    cameraMode: () => cameraMode,
    die: (livesLeft = 0) => {
      lives = livesLeft;
      EventBus.emit(GameEventType.PLAYER_DEATH, {
        position: new THREE.Vector3(0, 120, 0),
        lives: livesLeft,
      });
    },
    completeWave: (wave) => {
      session.setWave(wave);
      EventBus.emit(GameEventType.WAVE_COMPLETE, { wave, enemiesKilled: 0 });
    },
    completeLevel: (level) => {
      EventBus.emit(GameEventType.LEVEL_COMPLETE, { level });
    },
    destroyBoss: (level) => {
      session.setLevel(level);
      session.setInBossBattle(true);
      const type = getBossForLevel(level);
      expect(type, `level ${level} has a boss`).not.toBeNull();
      const config = BOSS_CONFIGS[type as keyof typeof BOSS_CONFIGS];
      call<void>(
        'handleBossDestroy',
        new THREE.Vector3(0, 200, -400),
        config,
        session.isBossMode()
      );
      // 收尾停顿（游戏时间）之后才是结算 / 机库 / 结局
      (target.campaign as CampaignFlowController).tick(3);
    },
    togglePause: () => call<void>('handlePauseToggle'),
    call,
    dispose: () => call<void>('dispose'),
  };
}
