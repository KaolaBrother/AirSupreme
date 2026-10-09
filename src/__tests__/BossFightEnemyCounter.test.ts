import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameCoordinator } from '@/core/GameCoordinator';
import { GameSessionState } from '@/core/GameSessionState';
import { PresentationController } from '@/core/PresentationController';
import type { ICampaignPresentation } from '@/core/campaign/CampaignPresentation';
import { UnitController } from '@/core/units/UnitController';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import { setLocale } from '@/i18n';
import type { BossMissileIndicator } from '@/ui/BossMissileIndicator';
import type { EnemyHealthBars } from '@/ui/EnemyHealthBars';
import { HUD, type HudEnemyCounterMode } from '@/ui/HUD';
import type { LockOnIndicator } from '@/ui/LockOnIndicator';
import { resetLocale } from './i18nTestUtils';

/**
 * 打磨批次 Q：Boss 战（Boss 模式，或战役关卡的 Boss 阶段）的敌人计数只显示在场的敌方
 * （Boss 放出的敌机 / 无人机与敌方单位），不再显示本关波次花名册的“剩余”；
 * 波次中照旧显示“ENEMIES n · LEFT m”。
 */

/** 任意方法都是 vi.fn() 的替身 */
function autoStub<T>(): T {
  const methods = new Map<PropertyKey, ReturnType<typeof vi.fn>>();
  return new Proxy(
    {},
    {
      get: (_target, key) => {
        if (key === 'then') return undefined;
        let method = methods.get(key);
        if (!method) {
          method = vi.fn();
          methods.set(key, method);
        }
        return method;
      },
    }
  ) as T;
}

const counter = (): string => document.getElementById('hud-wave-line')?.textContent ?? '';

describe('HUD.setEnemyCounterMode', () => {
  let hud: HUD;

  beforeEach(() => {
    document.body.innerHTML = '';
    hud = new HUD();
    hud.init();
    hud.updateEnemies(2);
    hud.updateRemainingEnemies(38);
  });

  afterEach(() => {
    hud.dispose();
    resetLocale();
    document.body.innerHTML = '';
  });

  it('starts in wave mode: ENEMIES n · LEFT m', () => {
    expect(counter()).toBe('ENEMIES 2 · LEFT 38');
  });

  it("'boss' shows only the live count, with no LEFT roster", () => {
    hud.setEnemyCounterMode('boss');
    expect(counter()).toBe('ENEMIES 2');
    hud.updateRemainingEnemies(12);
    hud.updateEnemies(5);
    expect(counter()).toBe('ENEMIES 5');
  });

  it("'boss' in Chinese: 敌人 n without 剩余, also across a language switch", () => {
    hud.setEnemyCounterMode('boss');
    setLocale('zh-CN');
    expect(counter()).toBe('敌人 2');
    setLocale('en');
    expect(counter()).toBe('ENEMIES 2');
  });

  it("'wave' brings LEFT back after a boss fight", () => {
    hud.setEnemyCounterMode('boss');
    hud.setEnemyCounterMode('wave');
    expect(counter()).toBe('ENEMIES 2 · LEFT 38');
    setLocale('zh-CN');
    expect(counter()).toBe('敌人 2 · 剩余 38');
  });

  it('an unknown mode counts as wave', () => {
    hud.setEnemyCounterMode('boss');
    hud.setEnemyCounterMode('roster' as HudEnemyCounterMode);
    expect(counter()).toBe('ENEMIES 2 · LEFT 38');
  });
});

describe('GameCoordinator.updateUI picks the counter for the fight', () => {
  interface World {
    /** 存活敌机（含 Boss 放出的） */
    jets: number;
    /** 本关波次花名册：总数 / 已出动 */
    total: number;
    spawned: number;
  }

  let hud: HUD;
  let session: GameSessionState;
  let world: World;
  let hostileUnits: { getAliveHostileCount(): number };
  let unitController: UnitController | null = null;

  beforeEach(() => {
    document.body.innerHTML = '';
    hud = new HUD();
    hud.init();
    session = new GameSessionState();
    session.setLevel(4);
    world = { jets: 0, total: 38, spawned: 0 };
    hostileUnits = { getAliveHostileCount: () => 0 };
  });

  afterEach(() => {
    unitController?.dispose();
    unitController = null;
    hud.dispose();
    resetLocale();
    document.body.innerHTML = '';
  });

  /** 白盒：只装 updateUI 用到的字段，跑一帧（超过 HUD 节流间隔） */
  function tick(): void {
    const coordinator = Object.create(GameCoordinator.prototype) as Record<string, unknown>;
    Object.assign(coordinator, {
      hud,
      sessionState: session,
      presentationController: new PresentationController({
        hud,
        enemyHealthBars: autoStub<EnemyHealthBars>(),
        bossIndicator: autoStub<BossMissileIndicator>(),
        lockOnIndicator: autoStub<LockOnIndicator>(),
      }),
      enemySystem: {
        getAliveEnemyCount: () => world.jets,
        getTotalEnemyCount: () => world.total,
        getSpawnedEnemyCount: () => world.spawned,
      },
      units: hostileUnits,
      hudFeed: { updateRadar: vi.fn(), updateHealthBars: vi.fn() },
      playerSystem: {
        getHealth: () => ({ getHealthPercent: () => 100 }),
        getSpeed: () => 0,
        getLives: () => 3,
      },
      gameState: { getScore: () => 0 },
      updatePlayerFacingObjective: vi.fn(),
    });
    const updateUI = (GameCoordinator.prototype as unknown as Record<string, unknown>).updateUI as (
      deltaTime: number
    ) => void;
    updateUI.call(coordinator, 1);
  }

  it('waves: ENEMIES (jets + hostile units) · LEFT (roster left + hostile units)', () => {
    world = { jets: 3, total: 40, spawned: 10 };
    hostileUnits = { getAliveHostileCount: () => 2 };
    tick();
    // 已击落 10 - 3 = 7：剩余 40 - 7 + 2 = 35
    expect(counter()).toBe('ENEMIES 5 · LEFT 35');
  });

  it('campaign boss stage: no wave roster ("ENEMIES 0 · LEFT 38" was the bug)', () => {
    session.setInBossBattle(true);
    tick();
    expect(counter()).toBe('ENEMIES 0');
  });

  it('campaign boss stage: counts the boss jets and hostile units that are present', () => {
    session.setInBossBattle(true);
    world = { jets: 2, total: 38, spawned: 2 };
    hostileUnits = { getAliveHostileCount: () => 1 };
    tick();
    expect(counter()).toBe('ENEMIES 3');
    setLocale('zh-CN');
    tick();
    expect(counter()).toBe('敌人 3');
  });

  it('Boss mode: the same live count, no LEFT', () => {
    session.setMode('boss');
    world = { jets: 1, total: 12, spawned: 1 };
    tick();
    expect(counter()).toBe('ENEMIES 1');
  });

  it('a boss-launched drone counts as a live hostile', async () => {
    unitController = new UnitController({
      scene: new THREE.Scene(),
      presentation: autoStub<ICampaignPresentation>(),
      awardKill: vi.fn(),
      applyPenalty: vi.fn(),
      onAssetLost: vi.fn(),
      damagePlayer: vi.fn(),
      onExplosion: vi.fn(),
      onEscortResult: vi.fn(),
    });
    await unitController.ensureLoaded(autoStub<ParticleSystem>());
    hostileUnits = unitController;
    session.setInBossBattle(true);
    tick();
    expect(counter()).toBe('ENEMIES 0');

    expect(unitController.spawnBossDrone(new THREE.Vector3(0, 300, -600))).toBe(true);
    expect(unitController.spawnBossDrone(new THREE.Vector3(40, 300, -600))).toBe(true);
    tick();
    expect(counter()).toBe('ENEMIES 2');
  });

  it('after the boss fight the next waves show LEFT again', () => {
    session.setInBossBattle(true);
    world = { jets: 0, total: 38, spawned: 0 };
    tick();
    expect(counter()).toBe('ENEMIES 0');

    session.setInBossBattle(false);
    session.setLevel(5);
    world = { jets: 1, total: 30, spawned: 1 };
    tick();
    expect(counter()).toBe('ENEMIES 1 · LEFT 30');
  });
});
