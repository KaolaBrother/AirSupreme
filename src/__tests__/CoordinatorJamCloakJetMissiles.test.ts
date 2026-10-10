import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_CONSTANTS, GameConfig } from '@/config';
import { EventBus, GameEventType } from '@/core/EventBus';
import { GameCoordinator } from '@/core/GameCoordinator';
import type { EnemySystem } from '@/core/systems/EnemySystem';
import type { PlayerSystem } from '@/core/systems/PlayerSystem';
import type { UnitController } from '@/core/units/UnitController';
import type { EnemyAI } from '@/features/enemy/EnemyAI';
import { EnemyType } from '@/features/enemy/EnemyTypes';
import { setLocale } from '@/i18n';
import type { LockOnIndicator } from '@/ui/LockOnIndicator';
import { resetLocale } from './i18nTestUtils';

/**
 * 敌机编队第 2 批在“玩家这一侧”的接线（规格 enemy-fleet-spec §2、§3：JAMMER / WRAITH / ACE /
 * STRIKER），从协调器的模拟步一路看到准星和 HUD：
 * - 干扰：玩家 800 米内至少有一架存活的干扰机时，导弹锁定时间变为 2.0 倍（不叠加），捕获环上
 *   显示 “JAMMED” / “受干扰”；范围内最后一架被击毁或飞出 800 米，效果随即结束；机炮与导引头的
 *   其余部分不变；
 * - 隐身：隐身中的敌机不能被锁定，已有的锁定在它隐身时丢掉，现形后可以重新锁定；已经在飞的
 *   玩家导弹不受影响；
 * - 敌机导弹：敌机锁定玩家时亮起与单位导弹相同的“被锁定”告警，发射时变为“导弹来袭”；
 *   热焰弹、EMP、近防炮对它照常有效。
 *
 * 台架：一台真的 GameCoordinator（jsdom 里只把渲染场景和飞控换成替身），表现层运行时与战斗运行时
 * 都由它自己加载和接线——真的 EnemySystem、UnitController / UnitSystem、CombatSystem、
 * SpecialWeaponsController、LockOnIndicator 和 HUD。每一步调用真的 update()，顺序由生产代码决定。
 * 敌机用 LevelManager.spawnEnemyAtPosition 生成（真的机体、条令和回调接线）；LevelManager.update
 * 换成替身，敌机因此停在测试摆好的位置上，不自己飞、不自己开火。条令内部的事（何时隐身、
 * 何时锁定、何时发射）由别的测试负责，这里直接给出“此刻隐身 / 正在锁定 / 发射一枚”。
 */

vi.mock('@/scenes/GameScene', () => ({
  GameScene: class {
    readonly scene = new THREE.Scene();
    readonly camera = new THREE.PerspectiveCamera(
      GAME_CONSTANTS.CAMERA.FOV,
      window.innerWidth / window.innerHeight,
      GAME_CONSTANTS.CAMERA.NEAR,
      GAME_CONSTANTS.CAMERA.FAR
    );

    setScreenEffects(): void {
      // 没有后处理
    }

    render(): void {
      // 不渲染
    }

    applyQualitySettings(): void {
      // 没有画质可调
    }

    applyLevelEnvironment(): void {
      // 没有环境
    }

    dispose(): void {
      // 没有要清理的
    }
  },
}));

// 飞控换成只报位姿的替身：座机停在测试摆好的位置和姿态上
vi.mock('@/features/player/PlayerController', () => ({
  PlayerController: class {
    private readonly aircraft: THREE.Group;

    constructor(aircraft: THREE.Group) {
      this.aircraft = aircraft;
    }

    getPosition(): THREE.Vector3 {
      return this.aircraft.position.clone();
    }

    getQuaternion(): THREE.Quaternion {
      return this.aircraft.quaternion.clone();
    }

    getSpeed(): number {
      return 0;
    }

    update(): void {
      // 座机不动
    }

    dispose(): void {
      // 没有要清理的
    }
  },
}));

type Stub = Record<string, unknown>;

interface Pixel {
  x: number;
  y: number;
}

const DT = 1 / 60;
const VIEWPORT = { width: 1280, height: 800 };
/** 测试里把锁定时间定为 1 秒：两倍就是 2 秒 */
const LOCK_TIME = 1.0;
/** 干扰半径（米），取自规格 */
const JAM_RANGE = 800;
const EYE_OFFSET = new THREE.Vector3(0, 0.46, -0.8);

const rad = THREE.MathUtils.degToRad;

function callPrivate<T>(target: Stub, name: string, ...args: unknown[]): T {
  const method = (GameCoordinator.prototype as unknown as Record<string, unknown>)[name];
  expect(typeof method, `GameCoordinator.${name}`).toBe('function');
  return (method as (...params: unknown[]) => T).apply(target, args);
}

function lockRoot(): HTMLElement {
  const root = document.getElementById('lock-on-indicator');
  expect(root, 'expected #lock-on-indicator in the document').toBeTruthy();
  return root as HTMLElement;
}

function lockChrome(name: string): HTMLElement {
  const matches = lockRoot().querySelectorAll<HTMLElement>(`[data-lock-chrome="${name}"]`);
  expect(matches.length, `expected exactly one [data-lock-chrome="${name}"]`).toBe(1);
  return matches[0];
}

/** 元素是否真的画出来：祖先链上没有 display:none，最近一个写明的 visibility 不是 hidden */
function isShown(element: Element): boolean {
  let visibility: string | null = null;
  for (let node: Element | null = element; node; node = node.parentElement) {
    const style = (node as HTMLElement).style;
    if (!style) continue;
    if (style.display === 'none') return false;
    if (visibility === null && style.visibility) visibility = style.visibility;
  }
  return visibility !== 'hidden' && element.isConnected;
}

/** 捕获环上的“受干扰”标签现在写着什么；没有显示时为 null */
function jamTagText(): string | null {
  const tag = lockChrome('jam-tag');
  return isShown(tag) ? (tag.textContent ?? '').trim() : null;
}

function leadMarkerShown(): boolean {
  const marker = lockRoot().querySelector('[data-lock-anchor="lead"]');
  expect(marker, 'expected the lead marker anchor').toBeTruthy();
  return isShown(marker as Element);
}

describe('GameCoordinator: jamming, cloak and jet missiles', () => {
  let originalIsMobile: boolean;
  let originalInnerWidth: number;
  let originalInnerHeight: number;
  let complaints: string[];
  /** 装在全局对象上的替身（画布、控制台、随机数），每个用例结束时逐个还原 */
  let globalSpies: Array<{ mockRestore: () => void }>;
  let rig: Rig;

  interface Rig {
    coordinator: Stub;
    indicator: LockOnIndicator;
    enemySystem: EnemySystem;
    units: UnitController;
    playerSystem: PlayerSystem;
    aircraft: THREE.Group;
    camera: THREE.PerspectiveCamera;
    /** 导弹键 / 机炮键的电平 */
    input: { missile: boolean; fire: boolean };
    /** 机体局部坐标（右 / 上 / 前，米）对应的世界坐标 */
    at(right: number, up: number, ahead: number): THREE.Vector3;
    /** 屏幕上准星右侧 px、下方 py 像素、距离 depth 米处的世界坐标 */
    atPixel(px: number, py: number, depth: number): THREE.Vector3;
    spawn(type: EnemyType, position: THREE.Vector3): EnemyAI;
    /** 击毁：一次足够大的伤害 */
    kill(jet: EnemyAI): void;
    /** 下一步里，在“敌机更新”的时刻（干扰判定之前）做一件事：敌机自己飞动就发生在这里 */
    duringEnemyUpdate(action: () => void): void;
    /** 若干个模拟步，每步之后一个渲染帧 */
    step(count?: number): void;
    run(seconds: number): void;
    progress(): number;
    /** 一步里锁定进度涨了多少 */
    progressStep(): number;
  }

  async function boot(): Promise<Rig> {
    const coordinator = new GameCoordinator({ showStartMenu: false }) as unknown as Stub;
    await callPrivate<Promise<void>>(coordinator, 'ensurePresentationRuntime');
    await callPrivate<Promise<unknown>>(coordinator, 'ensureGameplayRuntime');

    const indicator = coordinator.lockOnIndicator as LockOnIndicator;
    const enemySystem = coordinator.enemySystem as EnemySystem;
    const units = coordinator.units as UnitController;
    const playerSystem = coordinator.playerSystem as PlayerSystem;
    const aircraft = coordinator.playerAircraft as THREE.Group;
    const camera = (coordinator.gameScene as { camera: THREE.PerspectiveCamera }).camera;
    expect(coordinator.presentationRuntimeReady, 'presentation runtime').toBe(true);
    expect(units.isReady(), 'unit system loaded').toBe(true);
    expect((coordinator.weapons as { isReady(): boolean }).isReady(), 'weapons loaded').toBe(true);
    expect(coordinator.combatSystem, 'combat system loaded').toBeTruthy();

    // 座机：离原点不远，带偏航 / 俯仰 / 滚转；相机在飞行员眼点
    aircraft.position.set(60, 320, -40);
    aircraft.quaternion.setFromEuler(new THREE.Euler(rad(8), rad(-35), rad(20), 'YXZ'));
    aircraft.updateMatrixWorld(true);
    camera.position.copy(EYE_OFFSET).applyQuaternion(aircraft.quaternion).add(aircraft.position);
    camera.quaternion.copy(aircraft.quaternion);
    camera.updateMatrixWorld(true);
    (coordinator.interpolatedCameraTargetPosition as THREE.Vector3).copy(aircraft.position);
    (coordinator.interpolatedCameraTargetQuaternion as THREE.Quaternion).copy(aircraft.quaternion);

    indicator.setLockTime(LOCK_TIME);
    (coordinator.sessionState as { setPlaying(): void }).setPlaying();

    // 输入：只有导弹键和机炮键由测试控制
    const input = { missile: false, fire: false };
    const inputHandler = coordinator.inputHandler as { getState(): Record<string, unknown> };
    const idle = { ...inputHandler.getState() };
    vi.spyOn(inputHandler, 'getState').mockImplementation(() => ({ ...idle, ...input }));

    // 敌机停在原地：LevelManager 的这一步只执行测试排好的动作（相当于敌机自己的移动），
    // 再像生产代码一样把已被击毁的敌机清出列表
    const levelManager = enemySystem.getLevelManager();
    const pending: Array<() => void> = [];
    vi.spyOn(levelManager, 'update').mockImplementation(() => {
      while (pending.length > 0) pending.shift()?.();
      const jets = levelManager.getEnemies();
      for (let i = jets.length - 1; i >= 0; i -= 1) {
        if (!jets[i].isAlive()) {
          jets[i].dispose();
          jets.splice(i, 1);
        }
      }
    });

    const at = (right: number, up: number, ahead: number): THREE.Vector3 =>
      new THREE.Vector3(right, up, -ahead)
        .applyQuaternion(aircraft.quaternion)
        .add(aircraft.position);

    const atPixel = (px: number, py: number, depth: number): THREE.Vector3 => {
      const halfHeight = depth * Math.tan(rad(camera.fov / 2));
      const halfWidth = halfHeight * camera.aspect;
      return new THREE.Vector3(
        (px / (VIEWPORT.width / 2)) * halfWidth,
        (-py / (VIEWPORT.height / 2)) * halfHeight,
        -depth
      ).applyMatrix4(camera.matrixWorld);
    };

    const spawn = (type: EnemyType, position: THREE.Vector3): EnemyAI => {
      const jet = levelManager.spawnEnemyAtPosition(type, position, false);
      expect(jet, `a ${type} jet`).toBeTruthy();
      const spawned = jet as EnemyAI;
      expect(spawned.getConfig().type).toBe(type);
      expect(spawned.isAlive()).toBe(true);
      expect(spawned.getMesh().position.distanceTo(position), 'the jet is where it was put').toBe(
        0
      );
      return spawned;
    };

    const step = (count = 1): void => {
      for (let i = 0; i < count; i += 1) {
        callPrivate(coordinator, 'update', DT);
        callPrivate(coordinator, 'renderAimHud', 1);
      }
    };

    const progress = (): number => indicator.getLockProgress();

    return {
      coordinator,
      indicator,
      enemySystem,
      units,
      playerSystem,
      aircraft,
      camera,
      input,
      at,
      atPixel,
      spawn,
      kill: (jet) => {
        jet.takeDamage(1e6);
        expect(jet.isAlive(), 'the jet is destroyed').toBe(false);
      },
      duringEnemyUpdate: (action) => {
        pending.push(action);
      },
      step,
      run: (seconds) => step(Math.round(seconds / DT)),
      progress,
      progressStep: () => {
        const before = progress();
        step();
        return progress() - before;
      },
    };
  }

  /** 走到导引头开始跟踪 jet，再数到锁定完成用了多少步（超过上限返回 -1） */
  function stepsToLock(jet: EnemyAI, limit = 400): number {
    const seeker = rig.indicator.getSeeker();
    for (let i = 0; i < 5 && seeker.getTarget() !== jet.getMesh(); i += 1) rig.step();
    expect(seeker.getTarget(), 'the seeker should be tracking the jet').toBe(jet.getMesh());
    for (let i = 1; i <= limit; i += 1) {
      rig.step();
      if (rig.indicator.isLocked()) return i;
    }
    return -1;
  }

  /** 机头正前方 500 米的一架战斗机：导引头的目标 */
  function fighterOnNose(distance = 500): EnemyAI {
    return rig.spawn(EnemyType.FIGHTER, rig.at(0, 0, distance));
  }

  /** 让导引头跟踪 jet，进度攒到 atLeast 以上 */
  function trackTo(jet: EnemyAI, atLeast: number): void {
    const seeker = rig.indicator.getSeeker();
    for (
      let i = 0;
      i < 600 && (seeker.getTarget() !== jet.getMesh() || rig.progress() < atLeast);
      i += 1
    ) {
      rig.step();
    }
    expect(seeker.getTarget()).toBe(jet.getMesh());
    expect(rig.progress()).toBeGreaterThanOrEqual(atLeast);
    expect(rig.indicator.isLocked()).toBe(false);
  }

  beforeEach(async () => {
    originalIsMobile = GameConfig.isMobile;
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: VIEWPORT.width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: VIEWPORT.height });
    GameConfig.isMobile = false;
    document.body.innerHTML = '';
    EventBus.clear();
    // jsdom 没有画布：贴图生成拿不到 2D 上下文，各处都有“拿不到就不画”的分支
    globalSpies = [vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)];
    // 运行时的日志不进测试输出；加载失败之类的抱怨留下来检查
    complaints = [];
    const record = (...args: unknown[]): void => {
      complaints.push(args.map(String).join(' '));
    };
    globalSpies.push(
      vi.spyOn(console, 'error').mockImplementation(record),
      vi.spyOn(console, 'warn').mockImplementation(record),
      vi.spyOn(console, 'log').mockImplementation(() => undefined),
      vi.spyOn(console, 'info').mockImplementation(() => undefined),
      vi.spyOn(console, 'debug').mockImplementation(() => undefined)
    );

    rig = await boot();
    expect(complaints.filter((line) => /failed to (load|initialize)/i.test(line))).toEqual([]);
  });

  afterEach(() => {
    (rig.coordinator.dispose as () => void).call(rig.coordinator);
    // 只还原这里装上的全局替身：vi.restoreAllMocks() 会连 setup.ts 里共用的尾迹替身一起清掉。
    // 装在协调器、敌机和表现层上的替身随这一台台架一起丢弃
    for (const spy of globalSpies) spy.mockRestore();
    EventBus.clear();
    resetLocale();
    GameConfig.isMobile = originalIsMobile;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    });
    document.body.innerHTML = '';
  });

  describe('test rig', () => {
    it('locks an ordinary jet on the nose in the lock time, with no Jammer about', () => {
      const fighter = fighterOnNose();

      const steps = stepsToLock(fighter);

      expect(steps * DT).toBeGreaterThan(LOCK_TIME - 2 * DT);
      expect(steps * DT).toBeLessThan(LOCK_TIME + 3 * DT);
      expect(rig.indicator.getSeeker().getLockedTarget()).toBe(fighter.getMesh());
      expect(jamTagText()).toBeNull();
      expect(rig.playerSystem.isPlayerRespawning()).toBe(false);
    });
  });

  // ─────────────────────────────── 干扰 ───────────────────────────────

  describe('jamming', () => {
    // 干扰机相对座机的位置（右 / 上 / 前，米）与直线距离
    const IN_RANGE: ReadonlyArray<readonly [string, number, number, number]> = [
      ['799 m behind', 0, 0, -799],
      ['799 m off the right wing', 799, 0, 0],
      ['799 m straight below', 0, -799, 0],
      ['560 m to the left and 560 m above (792 m away)', -560, 560, 0],
      ['30 m off the wing tip', 30, 0, 5],
    ];
    const OUT_OF_RANGE: ReadonlyArray<readonly [string, number, number, number]> = [
      ['801 m behind', 0, 0, -801],
      ['801 m off the left wing', -801, 0, 0],
      ['600 m to the right and 600 m above (849 m away)', 600, 600, 0],
      ['1500 m behind', 0, 0, -1500],
    ];

    it.each(IN_RANGE)(
      'takes exactly twice as long to lock with a live Jammer %s',
      (_name, right, up, ahead) => {
        const fighter = fighterOnNose();
        const jammer = rig.spawn(EnemyType.JAMMER, rig.at(right, up, ahead));
        expect(jammer.getMesh().position.distanceTo(rig.aircraft.position)).toBeLessThan(JAM_RANGE);

        const steps = stepsToLock(fighter);

        expect(steps * DT).toBeGreaterThan(2 * LOCK_TIME - 2 * DT);
        expect(steps * DT).toBeLessThan(2 * LOCK_TIME + 3 * DT);
        expect(rig.indicator.getSeeker().getLockedTarget()).toBe(fighter.getMesh());
      }
    );

    it('fills the lock at exactly half the rate on every step', () => {
      const fighter = fighterOnNose();
      rig.spawn(EnemyType.JAMMER, rig.at(0, 0, -400));
      trackTo(fighter, 0.05);

      for (let i = 0; i < 60; i += 1) {
        expect(rig.progressStep(), `step ${i}`).toBeCloseTo(DT / (2 * LOCK_TIME), 9);
      }
    });

    it.each(OUT_OF_RANGE)(
      'locks in the normal time with the Jammer %s',
      (_name, right, up, ahead) => {
        const fighter = fighterOnNose();
        const jammer = rig.spawn(EnemyType.JAMMER, rig.at(right, up, ahead));
        expect(jammer.getMesh().position.distanceTo(rig.aircraft.position)).toBeGreaterThan(
          JAM_RANGE
        );

        const steps = stepsToLock(fighter);

        expect(steps * DT).toBeGreaterThan(LOCK_TIME - 2 * DT);
        expect(steps * DT).toBeLessThan(LOCK_TIME + 3 * DT);
        expect(jamTagText()).toBeNull();
      }
    );

    it.each([2, 3])('does not stack: %s Jammers in range still make it 2.0×', (count) => {
      const fighter = fighterOnNose();
      for (let i = 0; i < count; i += 1) {
        rig.spawn(EnemyType.JAMMER, rig.at(150 * (i + 1), 40, -300));
      }
      trackTo(fighter, 0.05);

      for (let i = 0; i < 20; i += 1) {
        expect(rig.progressStep(), `step ${i}`).toBeCloseTo(DT / (2 * LOCK_TIME), 9);
      }
      const steps = stepsToLock(fighter);
      expect(rig.indicator.isLocked()).toBe(true);
      expect(steps).toBeGreaterThan(0);
    });

    it.each(Object.values(EnemyType).filter((type) => type !== EnemyType.JAMMER))(
      'is not caused by a %s in range',
      (type) => {
        const fighter = fighterOnNose();
        rig.spawn(type, rig.at(0, 0, -300));

        const steps = stepsToLock(fighter);

        expect(steps * DT).toBeLessThan(LOCK_TIME + 3 * DT);
        expect(jamTagText()).toBeNull();
      }
    );

    it('is not caused by a Jammer that was shot down before it could matter', () => {
      const fighter = fighterOnNose();
      const jammer = rig.spawn(EnemyType.JAMMER, rig.at(0, 0, -300));
      rig.kill(jammer);

      const steps = stepsToLock(fighter);

      expect(steps * DT).toBeLessThan(LOCK_TIME + 3 * DT);
      expect(jamTagText()).toBeNull();
    });

    it('slows the lock on the Jammer itself too: it is an ordinary target', () => {
      const jammer = rig.spawn(EnemyType.JAMMER, rig.at(0, 0, 500));

      const steps = stepsToLock(jammer);

      expect(steps * DT).toBeGreaterThan(2 * LOCK_TIME - 2 * DT);
      expect(steps * DT).toBeLessThan(2 * LOCK_TIME + 3 * DT);
      expect(rig.indicator.getSeeker().getLockedTarget()).toBe(jammer.getMesh());
    });

    describe('when the last Jammer in range is shot down', () => {
      // 击毁发生在两步之间，等同于生产顺序里“本步末尾的命中结算”（在导引头和干扰判定之后）
      it('keeps jamming while another one in range is alive', () => {
        const fighter = fighterOnNose();
        const first = rig.spawn(EnemyType.JAMMER, rig.at(200, 0, -300));
        rig.spawn(EnemyType.JAMMER, rig.at(-200, 0, -300));
        trackTo(fighter, 0.1);

        rig.kill(first);

        for (let i = 0; i < 10; i += 1) {
          expect(rig.progressStep(), `step ${i}`).toBeCloseTo(DT / (2 * LOCK_TIME), 9);
          expect(jamTagText()).toBe('JAMMED');
        }
      });

      it('keeps jamming while another one that is out of range dies', () => {
        const fighter = fighterOnNose();
        rig.spawn(EnemyType.JAMMER, rig.at(200, 0, -300));
        const far = rig.spawn(EnemyType.JAMMER, rig.at(0, 0, -1000));
        trackTo(fighter, 0.1);

        rig.kill(far);

        for (let i = 0; i < 10; i += 1) {
          expect(rig.progressStep(), `step ${i}`).toBeCloseTo(DT / (2 * LOCK_TIME), 9);
        }
      });

      // FINDING（与规格差一步）：规格 §3 JAMMER 写的是“范围内最后一架干扰机被击毁时，效果立即
      // 结束”。实际晚一个模拟步（1/60 秒）：update() 里先推进导引头（读的是上一步的干扰判定），
      // 然后 EnemySystem 复核干扰，最后才做命中结算——机炮、导弹、特殊武器的伤害都在判定之后。
      // 击毁因此总是落在本步的判定之后：下一步的导引头读到的仍是“受干扰”，锁定照旧半速，标签
      // 也还在；再下一步才恢复。飞出 800 米没有这个问题（敌机的移动在同一步的判定之前）。
      it.fails('goes back to the normal lock rate on the step after the kill', () => {
        const fighter = fighterOnNose();
        const jammer = rig.spawn(EnemyType.JAMMER, rig.at(200, 0, -300));
        trackTo(fighter, 0.1);

        rig.kill(jammer);

        expect(rig.progressStep()).toBeCloseTo(DT / LOCK_TIME, 9);
      });

      // FINDING：同上——击毁后的那一步，捕获环上还写着 “JAMMED”
      it.fails('takes the tag away on the step after the kill', () => {
        fighterOnNose();
        const jammer = rig.spawn(EnemyType.JAMMER, rig.at(200, 0, -300));
        rig.step(3);
        expect(jamTagText()).toBe('JAMMED');

        rig.kill(jammer);
        rig.step();

        expect(jamTagText()).toBeNull();
      });

      it('has ended the slowdown and taken the tag away by the step after that at the latest', () => {
        const fighter = fighterOnNose();
        const jammer = rig.spawn(EnemyType.JAMMER, rig.at(200, 0, -300));
        trackTo(fighter, 0.1);

        rig.kill(jammer);
        rig.step();

        for (let i = 0; i < 10; i += 1) {
          expect(rig.progressStep(), `step ${i}`).toBeCloseTo(DT / LOCK_TIME, 9);
          expect(jamTagText()).toBeNull();
        }
      });

      it('finishes the rest of the lock at the normal rate, keeping the progress made', () => {
        const fighter = fighterOnNose();
        const jammer = rig.spawn(EnemyType.JAMMER, rig.at(200, 0, -300));
        trackTo(fighter, 0.4);
        const made = rig.progress();

        rig.kill(jammer);
        rig.step(2);
        expect(rig.progress()).toBeGreaterThan(made);
        const left = 1 - rig.progress();
        const steps = stepsToLock(fighter);

        expect(steps * DT).toBeGreaterThan(left * LOCK_TIME - 2 * DT);
        expect(steps * DT).toBeLessThan(left * LOCK_TIME + 3 * DT);
      });
    });

    describe('when the last Jammer in range leaves 800 m', () => {
      it('ends the slowdown and takes the tag away on the step after it crosses out', () => {
        const fighter = fighterOnNose();
        const jammer = rig.spawn(EnemyType.JAMMER, rig.at(0, 0, -790));
        trackTo(fighter, 0.1);
        expect(jamTagText()).toBe('JAMMED');

        // 干扰机在这一步里飞出 800 米：这一步开始时它还在范围内
        rig.duringEnemyUpdate(() => jammer.getMesh().position.copy(rig.at(0, 0, -805)));
        expect(rig.progressStep()).toBeCloseTo(DT / (2 * LOCK_TIME), 9);

        for (let i = 0; i < 10; i += 1) {
          expect(rig.progressStep(), `step ${i}`).toBeCloseTo(DT / LOCK_TIME, 9);
          expect(jamTagText()).toBeNull();
        }
      });

      it('starts again on the step after it comes back inside', () => {
        const fighter = fighterOnNose();
        const jammer = rig.spawn(EnemyType.JAMMER, rig.at(0, 0, -805));
        trackTo(fighter, 0.1);
        expect(jamTagText()).toBeNull();

        rig.duringEnemyUpdate(() => jammer.getMesh().position.copy(rig.at(0, 0, -790)));
        expect(rig.progressStep()).toBeCloseTo(DT / LOCK_TIME, 9);

        for (let i = 0; i < 10; i += 1) {
          expect(rig.progressStep(), `step ${i}`).toBeCloseTo(DT / (2 * LOCK_TIME), 9);
          expect(jamTagText()).toBe('JAMMED');
        }
      });

      it('keeps jamming while one of two stays inside', () => {
        const fighter = fighterOnNose();
        const leaving = rig.spawn(EnemyType.JAMMER, rig.at(0, 0, -790));
        rig.spawn(EnemyType.JAMMER, rig.at(300, 0, -300));
        trackTo(fighter, 0.1);

        rig.duringEnemyUpdate(() => leaving.getMesh().position.copy(rig.at(0, 0, -900)));
        rig.step();

        for (let i = 0; i < 10; i += 1) {
          expect(rig.progressStep(), `step ${i}`).toBeCloseTo(DT / (2 * LOCK_TIME), 9);
        }
      });

      it('measures the 800 m from where the player is now', () => {
        const jammer = rig.spawn(EnemyType.JAMMER, rig.at(0, 0, -700));
        rig.step(3);
        expect(jamTagText()).toBe('JAMMED');

        // 座机飞开 200 米：同一架干扰机现在在 900 米外
        const away = rig.at(0, 0, 200);
        rig.aircraft.position.copy(away);
        rig.camera.position.copy(EYE_OFFSET).applyQuaternion(rig.aircraft.quaternion).add(away);
        rig.camera.updateMatrixWorld(true);
        expect(jammer.getMesh().position.distanceTo(rig.aircraft.position)).toBeCloseTo(900, 3);
        rig.step(3);

        expect(jamTagText()).toBeNull();
      });
    });

    // 规格没有单独写“被 EMP 瘫痪的干扰机”：§2.7 列出的瘫痪效果是不转向、不开火、交还令牌、
    // 取消蓄力、现形，没有“停止干扰”；JAMMER 的条件只有“存活、在 800 米内”。按字面，它仍在干扰。
    it('keeps jamming while the Jammer is stunned by an EMP (it is alive and in range)', () => {
      const fighter = fighterOnNose();
      const jammer = rig.spawn(EnemyType.JAMMER, rig.at(200, 0, -300));
      trackTo(fighter, 0.05);

      jammer.applyStun(5);
      expect(jammer.isStunned()).toBe(true);

      for (let i = 0; i < 20; i += 1) {
        expect(rig.progressStep(), `step ${i}`).toBeCloseTo(DT / (2 * LOCK_TIME), 9);
        expect(jamTagText()).toBe('JAMMED');
      }
    });

    describe('nothing else about the seeker changes', () => {
      it('keeps the acquire ring and the keep ring the same size', () => {
        const before = {
          acquire: rig.indicator.getAcquireRadius(),
          keep: rig.indicator.getKeepRadius(),
        };
        const jammer = rig.spawn(EnemyType.JAMMER, rig.at(0, 0, -805));
        rig.step(3);
        expect(jamTagText()).toBeNull();

        rig.duringEnemyUpdate(() => jammer.getMesh().position.copy(rig.at(0, 0, -300)));
        rig.step(5);

        expect(jamTagText()).toBe('JAMMED');
        expect(rig.indicator.getAcquireRadius()).toBe(before.acquire);
        expect(rig.indicator.getKeepRadius()).toBe(before.keep);
      });

      it.each([
        ['just inside the acquire ring', -6, true],
        ['just outside the acquire ring', 6, false],
      ] as const)('still decides by the same ring: a jet %s', (_name, offset, acquired) => {
        // 先让干扰生效，再把敌机放到环边上：这样第一步就是在受干扰的状态下判定的
        rig.spawn(EnemyType.JAMMER, rig.at(0, 0, -300));
        rig.step(3);
        expect(jamTagText()).toBe('JAMMED');
        const radius = rig.indicator.getAcquireRadius();
        const fighter = rig.spawn(EnemyType.FIGHTER, rig.atPixel(radius + offset, 0, 500));

        rig.run(0.5);

        expect(jamTagText()).toBe('JAMMED');
        expect(rig.indicator.getSeeker().getTarget()).toBe(acquired ? fighter.getMesh() : null);
        expect(rig.progress() > 0).toBe(acquired);
      });

      it('still picks the jet nearest the reticle', () => {
        rig.spawn(EnemyType.JAMMER, rig.at(0, 0, -300));
        rig.spawn(EnemyType.FIGHTER, rig.atPixel(70, 10, 300));
        const nearest = rig.spawn(EnemyType.FIGHTER, rig.atPixel(-15, 5, 700));
        rig.spawn(EnemyType.FIGHTER, rig.atPixel(0, 60, 200));

        rig.run(0.3);

        expect(rig.indicator.getSeeker().getTarget()).toBe(nearest.getMesh());
      });

      it('still holds a completed lock out to the keep ring', () => {
        rig.spawn(EnemyType.JAMMER, rig.at(0, 0, -300));
        const fighter = fighterOnNose();
        expect(stepsToLock(fighter)).toBeGreaterThan(0);
        const keep = rig.indicator.getKeepRadius();

        fighter.getMesh().position.copy(rig.atPixel(keep - 8, 0, 500));
        rig.run(2);
        expect(rig.indicator.getSeeker().getLockedTarget()).toBe(fighter.getMesh());

        fighter.getMesh().position.copy(rig.atPixel(keep + 8, 0, 500));
        rig.run(GAME_CONSTANTS.MISSILE.LOCK_GRACE_TIME + 0.1);
        expect(rig.indicator.isLocked()).toBe(false);
      });

      it('launches at a completed lock on one press, as without a Jammer', () => {
        rig.spawn(EnemyType.JAMMER, rig.at(0, 0, -300));
        const fighter = fighterOnNose();
        expect(stepsToLock(fighter)).toBeGreaterThan(0);
        const missiles = (
          rig.coordinator.combatSystem as {
            getMissileSystem(): { hasActiveMissileToward(target: THREE.Object3D): boolean };
          }
        ).getMissileSystem();
        const before = rig.coordinator.missileCount as number;

        rig.input.missile = true;
        rig.step(3);
        rig.input.missile = false;
        rig.step();

        expect(rig.coordinator.missileCount).toBe(before - 1);
        expect(missiles.hasActiveMissileToward(fighter.getMesh())).toBe(true);
      });
    });

    describe('the gun', () => {
      interface Shot {
        position: THREE.Vector3;
        direction: THREE.Vector3;
      }

      /** 机炮此刻的样子：十字在哪、有没有提前量标记、辅助拉向谁、开一枪往哪打 */
      function gunReading(): {
        cross: Pixel;
        lead: boolean;
        assisted: boolean;
        shot: Shot;
      } {
        const shots: Shot[] = [];
        const off = EventBus.on(GameEventType.PLAYER_FIRED, (event) => {
          shots.push({
            position: event.payload.position.clone(),
            direction: event.payload.direction.clone(),
          });
        });
        rig.input.fire = true;
        for (let i = 0; i < 120 && shots.length === 0; i += 1) rig.step();
        rig.input.fire = false;
        off();
        expect(shots.length, 'the gun fired').toBeGreaterThan(0);
        const screen = rig.indicator.getGunCrossScreen();
        expect(screen.visible).toBe(true);
        return {
          cross: { x: screen.x, y: screen.y },
          lead: leadMarkerShown(),
          assisted: rig.indicator.isGunCrossAssisted(),
          shot: shots[0],
        };
      }

      it('keeps its lead marker, its assist and its bullets exactly as they were', () => {
        // 0.5 是没有散布：看的是弹道中心线
        globalSpies.push(vi.spyOn(Math, 'random').mockReturnValue(0.5));
        // 机头右侧 1° 的战斗机（键盘档的全量辅助区内）；干扰机先在范围外
        const fighter = rig.spawn(
          EnemyType.FIGHTER,
          rig.at(Math.sin(rad(1)) * 300, 0, Math.cos(rad(1)) * 300)
        );
        const jammer = rig.spawn(EnemyType.JAMMER, rig.at(0, 0, -900));
        rig.run(1.5);
        expect(jamTagText()).toBeNull();
        const clean = gunReading();
        expect(clean.lead).toBe(true);
        expect(clean.assisted).toBe(true);
        // 子弹正对战斗机
        const toFighter = fighter.getMesh().position.clone().sub(clean.shot.position).normalize();
        expect(clean.shot.direction.angleTo(toFighter)).toBeLessThan(rad(0.05));

        rig.duringEnemyUpdate(() => jammer.getMesh().position.copy(rig.at(0, 0, -300)));
        rig.run(1.5);
        expect(jamTagText()).toBe('JAMMED');
        const jammed = gunReading();

        expect(jammed.lead).toBe(true);
        expect(jammed.assisted).toBe(true);
        expect(jammed.cross.x).toBeCloseTo(clean.cross.x, 6);
        expect(jammed.cross.y).toBeCloseTo(clean.cross.y, 6);
        expect(jammed.shot.direction.angleTo(clean.shot.direction)).toBeLessThan(1e-9);
        expect(jammed.shot.position.distanceTo(clean.shot.position)).toBeLessThan(1e-9);
      });
    });
  });

  // ─────────────────────────────── “受干扰”标签 ───────────────────────────────

  describe('JAMMED tag on the lock ring', () => {
    it('is not there with no Jammer, with a Jammer out of range, or with a dead one', () => {
      rig.step(3);
      expect(jamTagText()).toBeNull();

      rig.spawn(EnemyType.JAMMER, rig.at(0, 0, -900));
      rig.step(3);
      expect(jamTagText()).toBeNull();

      const close = rig.spawn(EnemyType.JAMMER, rig.at(0, 0, -300));
      rig.kill(close);
      rig.step(3);
      expect(jamTagText()).toBeNull();
    });

    it.each([
      ['en', 'JAMMED'],
      ['zh-CN', '受干扰'],
    ] as const)('reads %s: %s while a live Jammer is in range', (locale, text) => {
      setLocale(locale);
      rig.spawn(EnemyType.JAMMER, rig.at(0, 0, -300));

      rig.step(3);

      expect(jamTagText()).toBe(text);
      expect(isShown(lockChrome('acquire-ring'))).toBe(true);
    });

    it('follows a language switch while it is up', () => {
      rig.spawn(EnemyType.JAMMER, rig.at(0, 0, -300));
      rig.step(3);
      expect(jamTagText()).toBe('JAMMED');

      setLocale('zh-CN');
      rig.step(2);
      expect(jamTagText()).toBe('受干扰');

      setLocale('en');
      rig.step(2);
      expect(jamTagText()).toBe('JAMMED');
    });

    it('is up whether the seeker is searching, tracking or locked', () => {
      rig.spawn(EnemyType.JAMMER, rig.at(0, 0, -300));
      rig.step(3);
      expect(rig.indicator.getLockState()).toBe('search');
      expect(jamTagText()).toBe('JAMMED');

      const fighter = fighterOnNose();
      trackTo(fighter, 0.3);
      expect(rig.indicator.getLockState()).toBe('track');
      expect(jamTagText()).toBe('JAMMED');

      expect(stepsToLock(fighter)).toBeGreaterThan(0);
      expect(rig.indicator.getLockState()).toBe('lock');
      expect(jamTagText()).toBe('JAMMED');
    });

    it('comes and goes with the effect, every time', () => {
      const jammer = rig.spawn(EnemyType.JAMMER, rig.at(0, 0, -790));
      for (let round = 0; round < 3; round += 1) {
        rig.duringEnemyUpdate(() => jammer.getMesh().position.copy(rig.at(0, 0, -790)));
        rig.step(2);
        expect(jamTagText(), `round ${round}: inside`).toBe('JAMMED');

        rig.duringEnemyUpdate(() => jammer.getMesh().position.copy(rig.at(0, 0, -810)));
        rig.step(2);
        expect(jamTagText(), `round ${round}: outside`).toBeNull();
      }
    });
  });

  // ─────────────────────────────── 隐身 ───────────────────────────────

  describe('a cloaked jet and the missile lock', () => {
    interface Cloakable {
      jet: EnemyAI;
      /** 此刻是否隐身（何时隐、何时现由条令决定，不在这里） */
      cloak(hidden: boolean): void;
    }

    function wraithAt(position: THREE.Vector3): Cloakable {
      const jet = rig.spawn(EnemyType.WRAITH, position);
      const state = { hidden: false };
      vi.spyOn(jet, 'isCloaked').mockImplementation(() => state.hidden && jet.isAlive());
      return {
        jet,
        cloak: (hidden) => {
          state.hidden = hidden;
        },
      };
    }

    function wraithOnNose(distance = 500): Cloakable {
      return wraithAt(rig.at(0, 0, distance));
    }

    function playerMissiles(): {
      hasActiveMissileToward(target: THREE.Object3D): boolean;
      getActiveCount(): number;
    } {
      return (
        rig.coordinator.combatSystem as {
          getMissileSystem(): {
            hasActiveMissileToward(target: THREE.Object3D): boolean;
            getActiveCount(): number;
          };
        }
      ).getMissileSystem();
    }

    function shownCue(): string | null {
      const cue = lockChrome('cue');
      return isShown(cue) ? (cue.textContent ?? '').trim() : null;
    }

    /** 按住导弹键若干秒再松开一步 */
    function press(seconds = 0.1): void {
      rig.input.missile = true;
      rig.run(seconds);
      rig.input.missile = false;
      rig.step();
    }

    function expectSearching(): void {
      const seeker = rig.indicator.getSeeker();
      expect(seeker.getTarget()).toBeNull();
      expect(seeker.getLockedTarget()).toBeNull();
      expect(rig.indicator.isLocked()).toBe(false);
      expect(rig.progress()).toBe(0);
      expect(rig.indicator.getLockState()).toBe('search');
      expect(lockRoot().getAttribute('data-lock-state')).toBe('search');
    }

    it('is left out of the lock candidates while it is cloaked, and only then', () => {
      const wraith = wraithOnNose();
      const fighter = rig.spawn(EnemyType.FIGHTER, rig.at(80, 0, 500));
      const candidates = (): THREE.Object3D[] => [
        ...callPrivate<THREE.Object3D[]>(rig.coordinator, 'collectLockCandidates'),
      ];

      expect(candidates()).toEqual([wraith.jet.getMesh(), fighter.getMesh()]);

      wraith.cloak(true);
      expect(candidates()).toEqual([fighter.getMesh()]);

      wraith.cloak(false);
      expect(candidates()).toEqual([wraith.jet.getMesh(), fighter.getMesh()]);
    });

    it('is never picked up by the seeker, however long it sits on the nose', () => {
      const wraith = wraithOnNose();
      wraith.cloak(true);

      for (let i = 0; i < 180; i += 1) {
        rig.step();
        expect(rig.indicator.getSeeker().getTarget(), `step ${i}`).toBeNull();
      }

      expectSearching();
    });

    it('gets NO LOCK and no missile when the button is pressed', () => {
      const wraith = wraithOnNose();
      wraith.cloak(true);
      rig.run(1.5);
      const before = rig.coordinator.missileCount as number;

      press(0.1);

      expect(shownCue()).toBe('NO LOCK');
      expect(rig.coordinator.missileCount).toBe(before);
      expect(playerMissiles().getActiveCount()).toBe(0);
    });

    it('loses a half-built lock on the step it cloaks: back to searching, progress gone', () => {
      const wraith = wraithOnNose();
      trackTo(wraith.jet, 0.5);

      wraith.cloak(true);
      rig.step();

      expectSearching();
    });

    it('loses a completed lock on the step it cloaks, and the button launches nothing', () => {
      const wraith = wraithOnNose();
      expect(stepsToLock(wraith.jet)).toBeGreaterThan(0);
      expect(rig.indicator.getLockState()).toBe('lock');
      const before = rig.coordinator.missileCount as number;

      wraith.cloak(true);
      rig.step();
      expectSearching();

      press(1);
      expect(rig.coordinator.missileCount).toBe(before);
      expect(playerMissiles().getActiveCount()).toBe(0);
      expectSearching();
    });

    it('launches nothing when it cloaks while the button is held waiting for the lock', () => {
      const wraith = wraithOnNose();
      trackTo(wraith.jet, 0.6);
      const before = rig.coordinator.missileCount as number;

      rig.input.missile = true;
      rig.step(5);
      wraith.cloak(true);
      rig.run(1.5);
      rig.input.missile = false;
      rig.step();

      expect(rig.coordinator.missileCount).toBe(before);
      expect(playerMissiles().getActiveCount()).toBe(0);
    });

    it('can be locked again once it is visible, from zero and in the full lock time', () => {
      const wraith = wraithOnNose();
      expect(stepsToLock(wraith.jet)).toBeGreaterThan(0);
      wraith.cloak(true);
      rig.run(0.5);
      expectSearching();

      wraith.cloak(false);
      rig.step();
      expect(rig.indicator.getSeeker().getTarget()).toBe(wraith.jet.getMesh());
      expect(rig.progress()).toBeLessThan(0.05);
      const steps = stepsToLock(wraith.jet);

      expect(steps * DT).toBeGreaterThan(LOCK_TIME - 3 * DT);
      expect(steps * DT).toBeLessThan(LOCK_TIME + 3 * DT);
      expect(rig.indicator.getSeeker().getLockedTarget()).toBe(wraith.jet.getMesh());
    });

    it('leaves the lock to a visible jet beside it, even one farther from the reticle', () => {
      const wraith = wraithAt(rig.atPixel(0, 0, 400));
      wraith.cloak(true);
      const fighter = rig.spawn(EnemyType.FIGHTER, rig.atPixel(55, -20, 600));

      const steps = stepsToLock(fighter);

      expect(steps).toBeGreaterThan(0);
      expect(rig.indicator.getSeeker().getLockedTarget()).toBe(fighter.getMesh());
    });

    it('moves the lock on to a visible jet in the ring when the locked one cloaks', () => {
      const wraith = wraithAt(rig.atPixel(0, 0, 400));
      const fighter = rig.spawn(EnemyType.FIGHTER, rig.atPixel(60, 0, 600));
      expect(stepsToLock(wraith.jet)).toBeGreaterThan(0);

      wraith.cloak(true);
      rig.step(2);

      // 新目标从零开始攒进度
      expect(rig.indicator.getSeeker().getTarget()).toBe(fighter.getMesh());
      expect(rig.indicator.isLocked()).toBe(false);
      expect(rig.progress()).toBeLessThan(0.05);
    });

    describe('a missile already in flight', () => {
      /** 锁定并发射一枚，返回从发射到目标挨打用了多少步（没打中返回 -1） */
      function fireAndCountSteps(target: Cloakable, cloakAfterLaunch: boolean): number {
        expect(stepsToLock(target.jet)).toBeGreaterThan(0);
        const healthBefore = target.jet.getHealth().current;
        rig.input.missile = true;
        rig.step();
        rig.input.missile = false;
        expect(playerMissiles().hasActiveMissileToward(target.jet.getMesh())).toBe(true);
        if (cloakAfterLaunch) target.cloak(true);

        for (let i = 1; i <= 900; i += 1) {
          rig.step();
          if (cloakAfterLaunch && target.jet.isAlive() && i < 5) {
            // 导引头已经丢了它，导弹没有
            expect(rig.indicator.getSeeker().getTarget()).toBeNull();
          }
          if (target.jet.getHealth().current < healthBefore) return i;
        }
        return -1;
      }

      it('keeps homing on a jet that cloaks after the launch, and hits it', () => {
        const wraith = wraithOnNose(450);

        const steps = fireAndCountSteps(wraith, true);

        expect(steps).toBeGreaterThan(0);
        expect(steps * DT).toBeLessThan(8);
      });

      it('takes the same time to arrive as against a jet that stays visible', () => {
        const visible = wraithOnNose(450);
        const visibleSteps = fireAndCountSteps(visible, false);
        expect(visibleSteps).toBeGreaterThan(0);
        if (visible.jet.isAlive()) rig.kill(visible.jet);
        rig.run(1);

        const cloaking = wraithOnNose(450);
        const cloakedSteps = fireAndCountSteps(cloaking, true);

        expect(cloakedSteps).toBe(visibleSteps);
      });
    });
  });

  // ─────────────────────────────── 敌机导弹与玩家的告警 ───────────────────────────────

  describe('jet missiles and the player’s warnings', () => {
    interface PresentationCalls {
      unitEvents: unknown[][];
      flashes: unknown[][];
      radio: unknown[][];
    }

    type LockPhase = 'locking' | 'launched';

    interface UnitSystemLike {
      onLockWarning?: (unit: unknown, phase: LockPhase) => void;
      getPlayerLockState(): string;
      spawnUnit(type: string, position: THREE.Vector3): unknown;
    }

    function unitSystem(): UnitSystemLike {
      const system = rig.units.getSystem();
      expect(system, 'the unit system').toBeTruthy();
      return system as unknown as UnitSystemLike;
    }

    /** 记下表现层收到的告警音 / 闪烁告警 / 配音请求（照常转给真的表现层） */
    function watchPresentation(): PresentationCalls {
      const presentation = rig.coordinator.presentation as {
        onUnitEvent(...args: unknown[]): void;
        flashWarning(...args: unknown[]): void;
        genericRadio(...args: unknown[]): boolean;
      };
      const calls: PresentationCalls = { unitEvents: [], flashes: [], radio: [] };
      const onUnitEvent = presentation.onUnitEvent.bind(presentation);
      const flashWarning = presentation.flashWarning.bind(presentation);
      const genericRadio = presentation.genericRadio.bind(presentation);
      vi.spyOn(presentation, 'onUnitEvent').mockImplementation((...args) => {
        calls.unitEvents.push(args);
        onUnitEvent(...args);
      });
      vi.spyOn(presentation, 'flashWarning').mockImplementation((...args) => {
        calls.flashes.push(args);
        flashWarning(...args);
      });
      vi.spyOn(presentation, 'genericRadio').mockImplementation((...args) => {
        calls.radio.push(args);
        return genericRadio(...args);
      });
      return calls;
    }

    /** HUD 上的导弹告警：级别，以及那一行此刻的样子（没有显示时 markup 为 null） */
    function hudWarning(): { level: string; text: string | null; markup: string | null } {
      const hud = document.getElementById('hud');
      expect(hud, 'expected #hud').toBeTruthy();
      const row = document.getElementById('hud-missile-warning');
      const shown = row !== null && row.style.display !== 'none';
      return {
        level: hud?.getAttribute('data-missile-warning') ?? 'none',
        text: shown ? (row.textContent ?? '').trim() : null,
        markup: shown ? row.innerHTML : null,
      };
    }

    function flashText(): string | null {
      const row = document.getElementById('hud-flash-warning');
      if (!row || row.style.display === 'none') return null;
      return (row.textContent ?? '').trim();
    }

    function playerHealth(): number {
      return rig.playerSystem.getHealth().getCurrentHealth();
    }

    /** 一架带导弹的敌机在机头前方；locking(true) = 它此刻正在用导弹锁定玩家 */
    function missileJet(
      type: EnemyType,
      distance = 400
    ): { jet: EnemyAI; locking(active: boolean): void; launch(): void } {
      const jet = rig.spawn(type, rig.at(0, 0, distance));
      const state = { locking: false };
      vi.spyOn(jet, 'isMissileLocking').mockImplementation(() => state.locking && jet.isAlive());
      return {
        jet,
        locking: (active) => {
          state.locking = active;
        },
        // 条令发射一枚：离架点在机体处，方向对着玩家
        launch: () => {
          expect(jet.onMissileLaunch, 'the jet has a launch channel').toBeTypeOf('function');
          const from = jet.getMesh().position.clone();
          const direction = rig.aircraft.position.clone().sub(from).normalize();
          jet.onMissileLaunch?.(from, direction);
        },
      };
    }

    const MISSILE_JETS = [EnemyType.ACE, EnemyType.STRIKER] as const;

    describe('locking', () => {
      it.each(MISSILE_JETS)(
        'shows the locking warning while a %s is locking the player',
        (type) => {
          const calls = watchPresentation();
          const jet = missileJet(type);
          rig.step(2);
          expect(hudWarning().level).toBe('none');
          expect(hudWarning().text).toBeNull();

          jet.locking(true);
          rig.step();

          expect(hudWarning().level).toBe('locking');
          expect(hudWarning().text).not.toBeNull();
          expect(hudWarning().text).not.toBe('');
          // 锁定告警音响一次，不是每步都响
          rig.run(1);
          expect(calls.unitEvents).toEqual([['sam-locking', null]]);
          expect(hudWarning().level).toBe('locking');
          // 只是锁定：还没有导弹，也没有“来袭”的闪烁告警
          expect(rig.units.countJetMissilesInFlight()).toBe(0);
          expect(calls.flashes).toEqual([]);
        }
      );

      it('is the same warning a ground unit’s lock raises', () => {
        const calls = watchPresentation();
        // 单位的锁定：单位系统报告“锁定中”，并发出一次锁定事件
        const system = unitSystem();
        const state = vi.spyOn(system, 'getPlayerLockState').mockReturnValue('locking');
        system.onLockWarning?.({}, 'locking');
        rig.step();
        const fromUnit = { hud: hudWarning(), events: [...calls.unitEvents] };
        state.mockRestore();
        rig.step();
        expect(hudWarning().level).toBe('none');
        calls.unitEvents.length = 0;

        const jet = missileJet(EnemyType.ACE);
        jet.locking(true);
        rig.step();

        expect(fromUnit.hud.level).toBe('locking');
        expect(hudWarning()).toEqual(fromUnit.hud);
        expect(calls.unitEvents).toEqual(fromUnit.events);
      });

      it('clears when the jet gives up the lock without launching', () => {
        const jet = missileJet(EnemyType.ACE);
        jet.locking(true);
        rig.run(0.5);
        expect(hudWarning().level).toBe('locking');

        jet.locking(false);
        rig.step(2);

        expect(hudWarning().level).toBe('none');
        expect(hudWarning().text).toBeNull();
      });

      it('clears when the locking jet is shot down', () => {
        const jet = missileJet(EnemyType.STRIKER);
        jet.locking(true);
        rig.run(0.5);
        expect(hudWarning().level).toBe('locking');

        rig.kill(jet.jet);
        rig.step(2);

        expect(hudWarning().level).toBe('none');
      });

      it('sounds again for a new lock after the first one ended', () => {
        const calls = watchPresentation();
        const jet = missileJet(EnemyType.ACE);
        jet.locking(true);
        rig.run(0.3);
        jet.locking(false);
        rig.run(0.3);

        jet.locking(true);
        rig.run(0.3);

        expect(calls.unitEvents).toEqual([
          ['sam-locking', null],
          ['sam-locking', null],
        ]);
      });

      it('keeps the warning up while one of two jets is still locking', () => {
        const first = missileJet(EnemyType.ACE, 400);
        const second = missileJet(EnemyType.STRIKER, 600);
        first.locking(true);
        second.locking(true);
        rig.run(0.3);

        first.locking(false);
        rig.run(0.3);
        expect(hudWarning().level).toBe('locking');

        second.locking(false);
        rig.step(2);
        expect(hudWarning().level).toBe('none');
      });
    });

    describe('launch', () => {
      it.each(MISSILE_JETS)('turns the warning to incoming when a %s launches', (type) => {
        const calls = watchPresentation();
        const jet = missileJet(type);
        jet.locking(true);
        rig.run(0.5);
        const locking = hudWarning();
        expect(locking.level).toBe('locking');

        jet.launch();
        jet.locking(false);
        rig.step();

        expect(rig.units.countJetMissilesInFlight()).toBe(1);
        expect(hudWarning().level).toBe('incoming');
        expect(hudWarning().text).not.toBeNull();
        expect(hudWarning().text).not.toBe(locking.text);
        // 发射的告警音、闪烁告警和配音请求
        expect(calls.unitEvents).toEqual([
          ['sam-locking', null],
          ['sam-launched', null],
        ]);
        expect(flashText()).toBe('Missile inbound · Press G for flares');
        expect(calls.flashes).toHaveLength(1);
        expect(calls.flashes[0][1]).toBe('threat');
        expect(calls.radio).toEqual([['missile-warning']]);
      });

      it.each([
        ['en', 'Missile inbound · Tap FLARE'],
        ['zh-CN', '导弹来袭 · 点「热焰」键'],
      ] as const)('points a touch player at the FLARE button (%s)', (locale, text) => {
        GameConfig.isMobile = true;
        setLocale(locale);
        const jet = missileJet(EnemyType.ACE);

        jet.launch();
        rig.step();

        expect(flashText()).toBe(text);
      });

      it('is the same warning a ground unit’s missile raises', () => {
        const calls = watchPresentation();
        const system = unitSystem();
        const state = vi.spyOn(system, 'getPlayerLockState').mockReturnValue('incoming');
        system.onLockWarning?.({}, 'launched');
        rig.step();
        const fromUnit = {
          hud: hudWarning(),
          flash: flashText(),
          events: [...calls.unitEvents],
          flashes: [...calls.flashes],
        };
        state.mockRestore();
        // 等闪烁告警自己收起，再看敌机的这一枚
        rig.run(4);
        expect(hudWarning().level).toBe('none');
        expect(flashText()).toBeNull();
        calls.unitEvents.length = 0;
        calls.flashes.length = 0;

        const jet = missileJet(EnemyType.ACE);
        jet.launch();
        rig.step();

        expect(fromUnit.hud.level).toBe('incoming');
        expect(hudWarning()).toEqual(fromUnit.hud);
        expect(flashText()).toBe(fromUnit.flash);
        expect(calls.unitEvents).toEqual(fromUnit.events);
        expect(calls.flashes).toEqual(fromUnit.flashes);
      });

      it('launches nothing and warns of nothing when the jet has no launch to make', () => {
        const calls = watchPresentation();
        missileJet(EnemyType.ACE);

        rig.run(1);

        expect(rig.units.countJetMissilesInFlight()).toBe(0);
        expect(hudWarning().level).toBe('none');
        expect(calls.unitEvents).toEqual([]);
        expect(calls.flashes).toEqual([]);
      });

      it('hurts the player when nothing is done about it, and the warning ends with it', () => {
        const jet = missileJet(EnemyType.ACE, 350);
        const before = playerHealth();

        jet.launch();
        let hitAt = -1;
        for (let i = 1; i <= 600 && hitAt < 0; i += 1) {
          rig.step();
          if (playerHealth() < before) hitAt = i;
          else if (rig.units.countJetMissilesInFlight() > 0) {
            expect(hudWarning().level, `step ${i}`).toBe('incoming');
          }
        }

        expect(hitAt, 'the missile reached the player').toBeGreaterThan(0);
        expect(hitAt * DT).toBeLessThan(9);
        rig.step(2);
        expect(rig.units.countJetMissilesInFlight()).toBe(0);
        expect(hudWarning().level).toBe('none');
      });
    });

    describe('counters', () => {
      /** 发射一枚、飞一小会儿，然后做 counter；返回之后 8 秒里玩家掉了多少血 */
      function damageAfter(counter: () => void, jetDistance = 350): number {
        const jet = missileJet(EnemyType.ACE, jetDistance);
        const before = playerHealth();
        jet.launch();
        rig.run(0.5);
        expect(rig.units.countJetMissilesInFlight()).toBe(1);
        expect(hudWarning().level).toBe('incoming');

        counter();
        rig.run(8);

        return before - playerHealth();
      }

      function deployFlare(): void {
        const weapons = rig.coordinator.weapons as { getFlareCharges(): number };
        const charges = weapons.getFlareCharges();
        expect(charges, 'a flare to drop').toBeGreaterThan(0);
        const inputHandler = rig.coordinator.inputHandler as { consumeFlareDeploy(): boolean };
        const request = vi.spyOn(inputHandler, 'consumeFlareDeploy').mockReturnValueOnce(true);
        rig.step();
        request.mockRestore();
        expect(weapons.getFlareCharges()).toBe(charges - 1);
      }

      it('does damage when nothing is done (the control for the cases below)', () => {
        expect(damageAfter(() => undefined)).toBeGreaterThan(0);
      });

      it('is drawn off by a flare: no longer after the player, warning gone, no damage', () => {
        let afterFlare = -1;
        let levelAfterFlare = '';

        const damage = damageAfter(() => {
          deployFlare();
          rig.run(0.5);
          afterFlare = rig.units.countJetMissilesInFlight();
          levelAfterFlare = hudWarning().level;
        });

        expect(afterFlare).toBe(0);
        expect(levelAfterFlare).toBe('none');
        expect(damage).toBe(0);
      });

      it('is destroyed by an EMP pulse that reaches it: warning gone, no damage', () => {
        let afterPulse = -1;
        let levelAfterPulse = '';

        const damage = damageAfter(() => {
          callPrivate(rig.coordinator, 'handleEmpPulse', rig.aircraft.position.clone(), 600, 3);
          afterPulse = rig.units.countJetMissilesInFlight();
          rig.step();
          levelAfterPulse = hudWarning().level;
        });

        expect(afterPulse).toBe(0);
        expect(levelAfterPulse).toBe('none');
        expect(damage).toBe(0);
      });

      it('flies on through an EMP pulse that does not reach it', () => {
        const damage = damageAfter(() => {
          callPrivate(rig.coordinator, 'handleEmpPulse', rig.aircraft.position.clone(), 40, 3);
          expect(rig.units.countJetMissilesInFlight()).toBe(1);
        });

        expect(damage).toBeGreaterThan(0);
      });

      describe('a friendly frigate’s close-in guns', () => {
        /**
         * 一枚敌机导弹沿一条低空航路飞向玩家，航路中点正下方的海面上可以有一艘友军护卫舰
         * （导弹从它头顶 150 米处飞过）。返回发射那一刻在飞的敌机导弹数、8 秒后还在飞的数量，
         * 以及玩家掉了多少血。
         */
        function lowPass(withFrigate: boolean): {
          launched: number;
          left: number;
          damage: number;
        } {
          // 近防炮每次点射按概率拦截：这里让每次都命中
          globalSpies.push(vi.spyOn(Math, 'random').mockReturnValue(0));
          const middle = rig.at(0, 0, 300);
          if (withFrigate) {
            const frigate = unitSystem().spawnUnit(
              'ALLY_FRIGATE',
              new THREE.Vector3(middle.x, -48, middle.z)
            );
            expect(frigate, 'a friendly frigate').toBeTruthy();
          }
          rig.aircraft.position.set(middle.x, 102, middle.z + 300);
          rig.camera.position
            .copy(EYE_OFFSET)
            .applyQuaternion(rig.aircraft.quaternion)
            .add(rig.aircraft.position);
          rig.camera.updateMatrixWorld(true);
          const jet = rig.spawn(EnemyType.ACE, new THREE.Vector3(middle.x, 102, middle.z - 300));
          rig.step(2);
          const before = playerHealth();

          const from = jet.getMesh().position.clone();
          jet.onMissileLaunch?.(from, rig.aircraft.position.clone().sub(from).normalize());
          const launched = rig.units.countJetMissilesInFlight();
          rig.run(8);

          return {
            launched,
            left: rig.units.countJetMissilesInFlight(),
            damage: before - playerHealth(),
          };
        }

        it('lets the missile through when there is no frigate (the control)', () => {
          const result = lowPass(false);

          expect(result.launched).toBe(1);
          expect(result.damage).toBeGreaterThan(0);
        });

        it('shoot the missile down before it reaches the player', () => {
          const result = lowPass(true);

          expect(result.launched).toBe(1);
          expect(result.left).toBe(0);
          expect(result.damage).toBe(0);
          expect(hudWarning().level).toBe('none');
        });
      });
    });
  });
});
