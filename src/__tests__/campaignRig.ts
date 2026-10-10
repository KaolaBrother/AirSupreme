import { expect, vi } from 'vitest';
import { GameConfig } from '@/config';
import { EventBus, GameEventType } from '@/core/EventBus';
import { GameCoordinator } from '@/core/GameCoordinator';
import type { GameSessionState } from '@/core/GameSessionState';
import type { CampaignFlowController } from '@/core/campaign/CampaignFlowController';
import { CAMPAIGN_SAVE_VERSION, type CampaignSaveData } from '@/core/save/SaveSystem';
import type { EnemySystem } from '@/core/systems/EnemySystem';
import type { PlayerSystem } from '@/core/systems/PlayerSystem';
import type { UnitController } from '@/core/units/UnitController';
import type { EnemyAI } from '@/features/enemy/EnemyAI';
import type { LevelManager } from '@/features/levels/LevelManager';
import type { PlayerStats } from '@/features/upgrade/UpgradeSystem';
import type { HUD } from '@/ui/HUD';
import { settle } from './waveRig';

/**
 * 战役台架（敌机舰队 M3）：一台真的 GameCoordinator，在 jsdom 里跑真的战役流程——读档续玩
 * （restoreCheckpoint + CampaignFlowController.resumeFromCheckpoint，与开局时带 resume 的
 * startInternal 同一顺序）、入关（prepareLevel → startLevelCombat）、开波、按写定的编成出场、
 * 清波、下一波。表现层（HUD、大字提示）与战斗运行时由协调器自己加载和接线。
 *
 * 各测试文件自己用 vi.mock 把渲染场景（GameScene）、飞控（PlayerController）换成替身，地形换成
 * 平坦海面（TerrainGenerator）——写法见 EnemyFirstContactHints.test.ts。
 *
 * 台架里另外换掉的：
 * - 协调器的定时器（ResourceRegistry.scheduleTimeout）走测试台的虚拟时钟：每一步推进 dt，到点的
 *   回调在这一步之后按到点顺序执行。不读系统时钟，与机器快慢无关；
 * - 本波的地面 / 海上 / 空中单位不出场（UnitController.spawnForWave 换成空操作）：它们不是这里
 *   要看的东西，又会拖住清波；
 * - 击毁敌机由测试决定（run 的 kill 选项）。
 */

export type Stub = Record<string, unknown>;

/** 模拟步长（秒） */
export const CAMPAIGN_DT = 1 / 30;

export function callPrivate<T>(target: Stub, name: string, ...args: unknown[]): T {
  const method = (GameCoordinator.prototype as unknown as Record<string, unknown>)[name];
  expect(typeof method, `GameCoordinator.${name}`).toBe('function');
  return (method as (...params: unknown[]) => T).apply(target, args);
}

/** 一份“第 level 关、下一波是第 wave 波（0 起）”的检查点 */
export function waveCheckpoint(
  level: number,
  wave: number,
  overrides: Partial<CampaignSaveData> = {}
): CampaignSaveData {
  return {
    version: CAMPAIGN_SAVE_VERSION,
    savedAt: 0,
    checkpoint: 'wave',
    level,
    wave,
    difficulty: 3,
    score: 0,
    lives: 3,
    missiles: 4,
    upgrades: {},
    weapons: { unlocked: [], selected: null, ammo: {} },
    flares: 2,
    cameraMode: 'first-person',
    stats: { kills: 0, civiliansLost: 0, deaths: 0, playTimeSeconds: 0 },
    ...overrides,
  };
}

/** 大字提示通道上显示过的一段文字（虚拟时钟，秒） */
export interface CalloutShowing {
  text: string;
  from: number;
  /** 还在显示时为 NaN */
  to: number;
}

export interface WaveStartRecord {
  level: number;
  wave: number;
  at: number;
}

/** 一次语音 / 无线电调用 */
export interface VoiceCall {
  channel: string;
  args: unknown[];
  at: number;
}

/** 一个到点执行的定时回调做了什么 */
export interface TimerRun {
  at: number;
  /** 回调里交给 HUD 大字提示的文字（按当时的语言展开前的原样） */
  callouts: unknown[];
  voiceCalls: VoiceCall[];
}

interface VirtualTimer {
  id: number;
  due: number;
  callback: () => void;
}

export interface CampaignRigOptions {
  dt?: number;
}

export class CampaignRig {
  public readonly coordinator: Stub;
  public readonly hud: HUD;
  public readonly enemySystem: EnemySystem;
  public readonly levelManager: LevelManager;
  public readonly session: GameSessionState;
  public readonly campaign: CampaignFlowController;
  public readonly units: UnitController;
  public readonly playerSystem: PlayerSystem;
  public readonly playerStats: PlayerStats;
  public readonly dt: number;
  /** 虚拟时钟（秒） */
  public time = 0;
  public readonly callouts: CalloutShowing[] = [];
  public readonly waveStarts: WaveStartRecord[] = [];
  public readonly voiceCalls: VoiceCall[] = [];
  public readonly timerRuns: TimerRun[] = [];
  /** 敌机现身（onEnemySpawned 之后第一次在场时记下）：机型与时刻 */
  public readonly arrivals: Array<{ jet: EnemyAI; at: number }> = [];

  private readonly timers: VirtualTimer[] = [];
  private nextTimerId = 1;
  private activeRun: TimerRun | null = null;
  private readonly seenJets = new Set<EnemyAI>();
  private readonly unsubscribers: Array<() => void> = [];
  private startLevelCombatCalls = 0;

  private constructor(coordinator: Stub, dt: number) {
    this.coordinator = coordinator;
    this.dt = dt;
    this.hud = coordinator.hud as HUD;
    this.enemySystem = coordinator.enemySystem as EnemySystem;
    this.levelManager = this.enemySystem.getLevelManager();
    this.session = coordinator.sessionState as GameSessionState;
    this.campaign = coordinator.campaign as CampaignFlowController;
    this.units = coordinator.units as UnitController;
    this.playerSystem = coordinator.playerSystem as PlayerSystem;
    this.playerStats = coordinator.playerStats as PlayerStats;
  }

  public static async boot(options: CampaignRigOptions = {}): Promise<CampaignRig> {
    const coordinator = new GameCoordinator({ showStartMenu: false }) as unknown as Stub;
    await callPrivate<Promise<void>>(coordinator, 'ensurePresentationRuntime');
    await callPrivate<Promise<unknown>>(coordinator, 'ensureGameplayRuntime');
    expect(coordinator.presentationRuntimeReady, 'presentation runtime').toBe(true);
    expect(coordinator.enemySystem, 'enemy system').toBeTruthy();
    const rig = new CampaignRig(coordinator, options.dt ?? CAMPAIGN_DT);
    rig.install();
    rig.session.setPlaying();
    return rig;
  }

  private install(): void {
    const registry = this.coordinator.resourceRegistry as {
      scheduleTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
      cancelTimeout(id: ReturnType<typeof setTimeout>): void;
    };
    vi.spyOn(registry, 'scheduleTimeout').mockImplementation((callback, delay) => {
      const id = this.nextTimerId++;
      const wait = Number.isFinite(delay) ? Math.max(0, delay) : 0;
      this.timers.push({ id, due: this.time * 1000 + wait, callback });
      return id as unknown as ReturnType<typeof setTimeout>;
    });
    vi.spyOn(registry, 'cancelTimeout').mockImplementation((id) => {
      const index = this.timers.findIndex((timer) => timer.id === (id as unknown as number));
      if (index >= 0) this.timers.splice(index, 1);
    });

    // 本波的单位不出场
    vi.spyOn(this.units, 'spawnForWave').mockImplementation(() => 0);

    // 大字提示：记下每个定时回调交给 HUD 的文字
    const hud = this.hud;
    const showBig = hud.showPowerUpBig.bind(hud);
    vi.spyOn(hud, 'showPowerUpBig').mockImplementation((...args) => {
      this.activeRun?.callouts.push(args[1]);
      showBig(...args);
    });

    // 语音 / 无线电的入口：照常执行，只记下调用
    const presentation = this.coordinator.presentation as Record<string, unknown>;
    for (const channel of ['radio', 'genericRadio', 'unitFirstContact']) {
      this.recordCalls(presentation, channel, `presentation.${channel}`);
    }
    this.recordCalls(this.coordinator.voiceSystem as Record<string, unknown>, 'play', 'voice.play');

    const self = this.coordinator as Record<string, unknown>;
    const startLevelCombat = (self.startLevelCombat as (...args: unknown[]) => unknown).bind(self);
    self.startLevelCombat = (...args: unknown[]): unknown => {
      this.startLevelCombatCalls++;
      return startLevelCombat(...args);
    };

    this.unsubscribers.push(
      EventBus.on(GameEventType.WAVE_START, ({ payload }) => {
        this.waveStarts.push({ level: payload.level, wave: payload.wave, at: this.time });
      })
    );
  }

  private recordCalls(target: Record<string, unknown>, method: string, channel: string): void {
    const original = target[method];
    expect(typeof original, channel).toBe('function');
    const bound = (original as (...args: unknown[]) => unknown).bind(target);
    target[method] = (...args: unknown[]): unknown => {
      const call: VoiceCall = { channel, args, at: this.time };
      this.voiceCalls.push(call);
      this.activeRun?.voiceCalls.push(call);
      return bound(...args);
    };
  }

  /**
   * 读档续玩：与开局带 resume 时 startInternal 的顺序一样——先 restoreCheckpoint，再交给战役流程
   * resumeFromCheckpoint；等到入关（prepareLevel 之后的 startLevelCombat）真的发生为止。
   */
  public async resume(save: CampaignSaveData): Promise<void> {
    const before = this.startLevelCombatCalls;
    callPrivate(this.coordinator, 'restoreCheckpoint', save);
    this.campaign.resumeFromCheckpoint(save);
    await this.untilEntered(before);
  }

  /** 等到 startLevelCombat 被调用（入关的异步部分跑完） */
  public async untilEntered(before: number): Promise<void> {
    for (let i = 0; i < 50 && this.startLevelCombatCalls === before; i++) await settle();
    expect(this.startLevelCombatCalls, 'the level was entered').toBeGreaterThan(before);
  }

  public enteredCount(): number {
    return this.startLevelCombatCalls;
  }

  /** 推进一步：协调器 update → 到点的定时回调 → 让异步回调跑完 → 记录大字提示 */
  public async step(kill = false): Promise<void> {
    callPrivate(this.coordinator, 'update', this.dt);
    this.time += this.dt;
    this.runDueTimers();
    await settle();
    this.sampleCallout();
    for (const jet of this.levelManager.getEnemies()) {
      if (!jet.isAlive()) continue;
      if (!this.seenJets.has(jet)) {
        this.seenJets.add(jet);
        this.arrivals.push({ jet, at: this.time });
      }
      if (kill) jet.takeDamage(1e9);
    }
  }

  public async run(seconds: number, kill = false): Promise<void> {
    const steps = Math.round(seconds / this.dt);
    for (let i = 0; i < steps; i++) await this.step(kill);
  }

  /** 一直推进，直到 done() 成立；最多 maxSeconds */
  public async runUntil(done: () => boolean, maxSeconds: number, kill = false): Promise<boolean> {
    const steps = Math.round(maxSeconds / this.dt);
    for (let i = 0; i < steps; i++) {
      if (done()) return true;
      await this.step(kill);
    }
    return done();
  }

  private runDueTimers(): void {
    const now = this.time * 1000 + 1e-6;
    for (;;) {
      let next: VirtualTimer | null = null;
      for (const timer of this.timers) {
        if (timer.due > now) continue;
        if (!next || timer.due < next.due || (timer.due === next.due && timer.id < next.id)) {
          next = timer;
        }
      }
      if (!next) return;
      this.timers.splice(this.timers.indexOf(next), 1);
      const run: TimerRun = { at: this.time, callouts: [], voiceCalls: [] };
      this.activeRun = run;
      try {
        next.callback();
      } finally {
        this.activeRun = null;
      }
      this.timerRuns.push(run);
      this.sampleCallout();
    }
  }

  /** 大字提示此刻显示的文字（没有显示时为 null） */
  public calloutText(): string | null {
    const root = document.getElementById('hud-callout');
    if (!root || root.style.opacity !== '1') return null;
    const text = root.querySelector('.hud-callout-text')?.textContent ?? '';
    return text.trim() === '' ? null : text.trim();
  }

  private sampleCallout(): void {
    const text = this.calloutText();
    const last = this.callouts[this.callouts.length - 1];
    const open = last && Number.isNaN(last.to) ? last : null;
    if (open && open.text === text) return;
    if (open) open.to = this.time;
    if (text !== null) this.callouts.push({ text, from: this.time, to: Number.NaN });
  }

  /** 某段文字显示过的各段 */
  public showingsOf(text: string): CalloutShowing[] {
    return this.callouts.filter((showing) => showing.text === text);
  }

  public dispose(): void {
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    (this.coordinator.dispose as () => void).call(this.coordinator);
  }
}

/** jsdom 里的全局替身（视口、画布、控制台），返回还原函数 */
export function installCampaignGlobals(): () => void {
  const originalIsMobile = GameConfig.isMobile;
  const originalWidth = window.innerWidth;
  const originalHeight = window.innerHeight;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  GameConfig.isMobile = false;
  document.body.innerHTML = '';
  EventBus.clear();
  const spies = [
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null),
    vi.spyOn(console, 'error').mockImplementation(() => undefined),
    vi.spyOn(console, 'warn').mockImplementation(() => undefined),
    vi.spyOn(console, 'log').mockImplementation(() => undefined),
    vi.spyOn(console, 'info').mockImplementation(() => undefined),
    vi.spyOn(console, 'debug').mockImplementation(() => undefined),
  ];
  return () => {
    for (const spy of spies) spy.mockRestore();
    EventBus.clear();
    GameConfig.isMobile = originalIsMobile;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight });
    document.body.innerHTML = '';
  };
}
