import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_CONSTANTS, GameConfig } from '@/config';
import { EventBus, GameEventType } from '@/core/EventBus';
import { GameCoordinator } from '@/core/GameCoordinator';
import { GunLeadSolver } from '@/features/combat/GunLeadSolver';
import { LockOnIndicator } from '@/ui/LockOnIndicator';
import { resetLocale } from './i18nTestUtils';

/**
 * 导弹键“按一下发射一枚”（GameCoordinator，武器批次 W4），以及同一条链路上的
 * 挂架离架位置（W7）、导弹余量（W6）和准星的隐藏时机（W1）。
 *
 * 协调器整体依赖 WebGL，这里沿用 CoordinatorWiring.test.ts 的做法：以 GameCoordinator 原型
 * 为原型造一个对象，只给被测私有方法用到的字段，协作者换成替身。导引头与准星用真实的
 * LockOnIndicator（jsdom），发射出去的导弹由替身 MissileSystem.fire 记录（位置 / 方向当场复制，
 * 协调器复用同一个向量）。
 *
 * 不规定 InputHandler 怎样上报一次很短的点按：这里直接给协调器“按住 / 松开”的电平，
 * 每次按键都持续好几帧。
 */

type Stub = Record<string, unknown>;

interface Pose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

interface Launch {
  position: THREE.Vector3;
  direction: THREE.Vector3;
  target: THREE.Object3D | undefined;
  /** 交给导弹的载机速度（米/秒）：导弹继承它再加速 */
  launcherSpeed: unknown;
  /** 发射时刻（秒，自测试开始） */
  time: number;
}

/** 一架普通敌机：活着、没有隐身 */
interface FakeEnemy {
  mesh: THREE.Object3D;
  alive: boolean;
  isAlive: () => boolean;
  isCloaked: () => boolean;
  getMesh: () => THREE.Object3D;
}

const DT = 1 / 60;
const REARM = 0.35;
const VIEWPORT = { width: 1280, height: 800 };
const EYE_OFFSET = new THREE.Vector3(0, 0.46, -0.8);
const CHASE_OFFSET = new THREE.Vector3(
  GAME_CONSTANTS.CAMERA.OFFSET.x,
  GAME_CONSTANTS.CAMERA.OFFSET.y,
  GAME_CONSTANTS.CAMERA.OFFSET.z
);
/** 机体局部坐标里的翼下挂架（右 / 左） */
const PYLON = { x: 1.5, y: -0.2, z: -1.3 };

/** 任意方法都是 vi.fn() 的替身 */
function autoStub(): Stub {
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
  ) as Stub;
}

/** 怎么取、怎么调用都还是它自己的替身（用于不关心的协作者与内部步骤） */
function deepStub(): unknown {
  const callable = (): void => undefined;
  return new Proxy(callable, {
    get: () => deepStub(),
    apply: () => deepStub(),
    set: () => true,
  });
}

/** 以 GameCoordinator 原型为原型、字段由测试提供的对象 */
function coordinatorWith(fields: Stub): Stub {
  const target = Object.create(GameCoordinator.prototype) as Stub;
  Object.assign(target, fields);
  return target;
}

/** 只有 fields 里的成员是真的，其余成员（含其它私有方法）一律是 deepStub */
function looseCoordinator(fields: Stub): Stub {
  return new Proxy(fields, {
    get: (target, key) => (key in target ? target[key as string] : deepStub()),
    set: (target, key, value) => {
      target[key as string] = value;
      return true;
    },
  });
}

function callPrivate<T>(target: Stub, name: string, ...args: unknown[]): T {
  const method = (GameCoordinator.prototype as unknown as Record<string, unknown>)[name];
  expect(typeof method, `GameCoordinator.${name}`).toBe('function');
  return (method as (...params: unknown[]) => T).apply(target, args);
}

function levelPose(): Pose {
  return { position: new THREE.Vector3(0, 300, 0), quaternion: new THREE.Quaternion() };
}

function bankedPose(): Pose {
  return {
    position: new THREE.Vector3(820, 310, -1460),
    quaternion: new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(12),
        THREE.MathUtils.degToRad(-35),
        THREE.MathUtils.degToRad(25),
        'YXZ'
      )
    ),
  };
}

function createCamera(): THREE.PerspectiveCamera {
  return new THREE.PerspectiveCamera(
    GAME_CONSTANTS.CAMERA.FOV,
    VIEWPORT.width / VIEWPORT.height,
    GAME_CONSTANTS.CAMERA.NEAR,
    GAME_CONSTANTS.CAMERA.FAR
  );
}

/** 第一人称：相机在飞行员眼点，朝向与机体一致 */
function eyeCamera(pose: Pose): THREE.PerspectiveCamera {
  const camera = createCamera();
  camera.position.copy(EYE_OFFSET).applyQuaternion(pose.quaternion).add(pose.position);
  camera.quaternion.copy(pose.quaternion);
  camera.updateMatrixWorld(true);
  return camera;
}

/** 追尾：相机在机体后上方，看向机体 */
function chaseCamera(pose: Pose): THREE.PerspectiveCamera {
  const camera = createCamera();
  camera.position.copy(CHASE_OFFSET).applyQuaternion(pose.quaternion).add(pose.position);
  camera.up.set(0, 1, 0);
  camera.lookAt(pose.position);
  camera.updateMatrixWorld(true);
  return camera;
}

/** 机体局部坐标 → 世界坐标 */
function worldFromLocal(pose: Pose, x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z).applyQuaternion(pose.quaternion).add(pose.position);
}

/** 世界坐标 → 机体局部坐标 */
function localFromWorld(pose: Pose, world: THREE.Vector3): THREE.Vector3 {
  return world.clone().sub(pose.position).applyQuaternion(pose.quaternion.clone().invert());
}

function lockRoot(): HTMLElement {
  const root = document.getElementById('lock-on-indicator');
  expect(root, 'expected #lock-on-indicator in the document').toBeTruthy();
  return root as HTMLElement;
}

function chrome(name: string): HTMLElement {
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

function shownCue(): string | null {
  const cue = chrome('cue');
  return isShown(cue) ? (cue.textContent ?? '').trim() : null;
}

describe('player missile control (GameCoordinator)', () => {
  let indicator: LockOnIndicator;
  let nowMs: number;
  let originalIsMobile: boolean;
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeEach(() => {
    originalIsMobile = GameConfig.isMobile;
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    GameConfig.isMobile = false;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: VIEWPORT.width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: VIEWPORT.height });
    document.body.innerHTML = '';
    EventBus.clear();
    nowMs = 10_000;
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
    indicator = new LockOnIndicator();
    indicator.init();
    indicator.setLockTime(1.0);
  });

  afterEach(() => {
    indicator.dispose();
    vi.restoreAllMocks();
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

  interface RigOptions {
    missiles?: number;
    multiShot?: boolean;
    pose?: Pose;
    view?: 'first-person' | 'third-person';
    /** 载机当前速度（米/秒）；默认巡航 22.5 */
    speed?: number;
  }

  function createRig(options: RigOptions = {}) {
    const pose = options.pose ?? levelPose();
    const camera = options.view === 'third-person' ? chaseCamera(pose) : eyeCamera(pose);
    const launches: Launch[] = [];
    const scheduled: Array<{ callback: () => void; delay: number }> = [];
    const enemies: FakeEnemy[] = [];
    const state = {
      playing: true,
      paused: false,
      respawning: false,
      time: 0,
      speed: options.speed ?? 22.5,
    };
    const aircraft = { visible: true };
    const presentationController = autoStub();
    const coordinator = coordinatorWith({
      lockOnIndicator: indicator,
      presentationRuntimeReady: true,
      presentationController,
      audioManager: autoStub(),
      view: autoStub(),
      hud: autoStub(),
      tutorialCombatState: { active: false },
      sessionState: {
        isPlaying: () => state.playing,
        isPaused: () => state.paused,
        isBossMode: () => false,
        isInBossBattle: () => false,
      },
      storyHold: false,
      bossBattleController: null,
      enemySystem: { getEnemies: () => enemies },
      units: { collectLockTargets: () => undefined },
      lockTargets: [],
      playerAircraft: aircraft,
      playerSystem: {
        getPosition: () => pose.position,
        getQuaternion: () => pose.quaternion,
        getSpeed: () => state.speed,
        isPlayerRespawning: () => state.respawning,
      },
      gameScene: { camera },
      combatSystem: {
        getMissileSystem: () => ({
          fire: (
            position: THREE.Vector3,
            direction: THREE.Vector3,
            target?: THREE.Object3D,
            launcherSpeed?: unknown
          ) => {
            launches.push({
              position: position.clone(),
              direction: direction.clone(),
              target,
              launcherSpeed,
              time: state.time,
            });
          },
        }),
      },
      gunLeadSolver: new GunLeadSolver(),
      gunLeadPoint: new THREE.Vector3(),
      interpolatedCameraTargetPosition: pose.position,
      interpolatedCameraTargetQuaternion: pose.quaternion,
      scheduleTimeout: (callback: () => void, delay: number) => {
        scheduled.push({ callback, delay });
        return scheduled.length;
      },
      missileCount: options.missiles ?? 3,
      missileRespawnTimer: 0,
      multiShotActive: options.multiShot ?? false,
      missileHeldPrev: false,
      missilePressArmed: false,
      missileRearmTimer: 0,
      missilePylonSide: 1,
      missileSpawnPosition: new THREE.Vector3(),
      missileSpawnForward: new THREE.Vector3(),
    });

    /** 一个模拟步 + 一个渲染帧，导弹键处于给定电平 */
    const step = (held: boolean, seconds = DT): void => {
      const frames = Math.max(1, Math.round(seconds / DT));
      for (let i = 0; i < frames; i += 1) {
        callPrivate(coordinator, 'handleMissileInput', { missile: held }, DT);
        callPrivate(coordinator, 'renderAimHud', 1);
        state.time += DT;
        nowMs += DT * 1000;
      }
    };

    /** 敌机放在机头轴线上（准星正中） */
    const addEnemyOnNose = (distance = 600): FakeEnemy => {
      const mesh = new THREE.Object3D();
      mesh.position.copy(worldFromLocal(pose, 0, 0, -distance));
      const enemy: FakeEnemy = {
        mesh,
        alive: true,
        isAlive: () => enemy.alive,
        isCloaked: () => false,
        getMesh: () => mesh,
      };
      enemies.push(enemy);
      return enemy;
    };

    return {
      coordinator,
      pose,
      camera,
      launches,
      scheduled,
      enemies,
      state,
      aircraft,
      presentationController,
      step,
      addEnemyOnNose,
      /** 按住若干秒再松开一帧 */
      press: (seconds = 0.1): void => {
        step(true, seconds);
        step(false);
      },
      /** 不按键，直到完成锁定 */
      waitForLock: (): void => {
        for (let i = 0; i < 600 && !indicator.isLocked(); i += 1) step(false);
        expect(indicator.isLocked(), 'expected the seeker to complete a lock').toBe(true);
      },
      missiles: (): number => coordinator.missileCount as number,
      /** 到点执行齐射里排队的后续发射 */
      flushScheduled: (): void => {
        while (scheduled.length > 0) scheduled.shift()?.callback();
      },
    };
  }

  describe('with a completed lock', () => {
    it('launches nothing until the button is pressed', () => {
      const rig = createRig();
      const enemy = rig.addEnemyOnNose();

      rig.step(false, 3);

      expect(indicator.isLocked()).toBe(true);
      expect(indicator.getSeeker().getLockedTarget()).toBe(enemy.mesh);
      expect(rig.launches).toHaveLength(0);
      expect(rig.missiles()).toBe(3);
    });

    it('launches one missile at the locked target on a press', () => {
      const rig = createRig();
      const enemy = rig.addEnemyOnNose();
      rig.waitForLock();

      rig.step(true);

      expect(rig.launches).toHaveLength(1);
      expect(rig.launches[0].target).toBe(enemy.mesh);
      expect(rig.missiles()).toBe(2);
    });

    it('keeps the lock after the launch', () => {
      const rig = createRig();
      const enemy = rig.addEnemyOnNose();
      rig.waitForLock();

      rig.press();
      rig.step(false, 0.5);

      expect(rig.launches).toHaveLength(1);
      expect(indicator.isLocked()).toBe(true);
      expect(indicator.getSeeker().getLockedTarget()).toBe(enemy.mesh);
    });

    it('does not launch again while the button stays down', () => {
      const rig = createRig();
      rig.addEnemyOnNose();
      rig.waitForLock();

      rig.step(true, 3);

      expect(rig.launches).toHaveLength(1);
      expect(rig.missiles()).toBe(2);
    });

    it('launches a second missile on a second press once 0.35 s have passed', () => {
      const rig = createRig();
      const enemy = rig.addEnemyOnNose();
      rig.waitForLock();

      rig.press(0.05);
      rig.step(false, 0.45);
      rig.press(0.05);

      expect(rig.launches).toHaveLength(2);
      expect(rig.launches[1].target).toBe(enemy.mesh);
      expect(rig.launches[1].time - rig.launches[0].time).toBeGreaterThanOrEqual(REARM);
      expect(rig.missiles()).toBe(1);
    });

    it('ignores a second press that comes and goes inside the 0.35 s re-arm time', () => {
      const rig = createRig();
      rig.addEnemyOnNose();
      rig.waitForLock();

      rig.press(0.05);
      rig.step(false, 0.1);
      // 第二次按键在首发后约 0.17 ~ 0.22 秒，随后松开
      rig.press(0.05);
      rig.step(false, 1.5);

      expect(rig.launches).toHaveLength(1);
      expect(rig.missiles()).toBe(2);
    });

    it('spaces launches at least 0.35 s apart however fast the button is hammered', () => {
      const rig = createRig({ missiles: 5 });
      rig.addEnemyOnNose();
      rig.waitForLock();

      // 每 4 帧按一次（按 2 帧、松 2 帧），连按 4 秒
      for (let i = 0; i < 60; i += 1) {
        rig.step(true, 2 * DT);
        rig.step(false, 2 * DT);
      }

      expect(rig.launches).toHaveLength(5);
      expect(rig.missiles()).toBe(0);
      for (let i = 1; i < rig.launches.length; i += 1) {
        const gap = rig.launches[i].time - rig.launches[i - 1].time;
        expect(gap, `gap before launch ${i + 1}`).toBeGreaterThanOrEqual(REARM - 1e-9);
        expect(gap, `gap before launch ${i + 1}`).toBeLessThan(REARM + 0.15);
      }
    });

    it('tells the HUD the new count after a launch', () => {
      const rig = createRig();
      rig.addEnemyOnNose();
      rig.waitForLock();
      const updateMissileHud = rig.presentationController.updateMissileHud as ReturnType<
        typeof vi.fn
      >;
      updateMissileHud.mockClear();

      rig.step(true);

      const reported = updateMissileHud.mock.calls.map(
        ([, hudState]) => (hudState as { missileCount: number }).missileCount
      );
      expect(reported).toEqual([2]);
      expect(chrome('missile-count').getAttribute('data-count')).toBe('2');
    });

    it('does not launch at a target that was destroyed in the meantime', () => {
      const rig = createRig();
      const enemy = rig.addEnemyOnNose();
      rig.waitForLock();

      enemy.alive = false;
      rig.press();

      expect(rig.launches).toHaveLength(0);
      expect(rig.missiles()).toBe(3);
      expect(indicator.isLocked()).toBe(false);
    });

    it('launches the last missile and then answers a press with NO MSL', () => {
      const rig = createRig({ missiles: 1 });
      rig.addEnemyOnNose();
      rig.waitForLock();

      rig.press();
      expect(rig.launches).toHaveLength(1);
      expect(rig.missiles()).toBe(0);

      rig.step(false, 1.5);
      rig.press();

      expect(rig.launches).toHaveLength(1);
      expect(shownCue()).toBe('NO MSL');
    });
  });

  describe('while the seeker is still tracking', () => {
    /** 目标进环后先跟踪 0.3 秒（基础锁定时间 1.0 秒，此时还没锁定） */
    function trackingRig(options: RigOptions = {}) {
      const rig = createRig(options);
      const enemy = rig.addEnemyOnNose();
      rig.step(false, 0.3);
      expect(indicator.isLocked()).toBe(false);
      expect(indicator.getSeeker().getTarget()).toBe(enemy.mesh);
      return { rig, enemy };
    }

    it('launches nothing on the press itself', () => {
      const { rig } = trackingRig();

      rig.step(true, 0.2);

      expect(indicator.isLocked()).toBe(false);
      expect(rig.launches).toHaveLength(0);
      expect(rig.missiles()).toBe(3);
    });

    it('launches exactly once when the lock completes with the button still down', () => {
      const { rig, enemy } = trackingRig();

      let lockedAt: number | null = null;
      for (let i = 0; i < 240; i += 1) {
        rig.step(true);
        if (lockedAt === null && indicator.isLocked()) lockedAt = rig.state.time;
      }

      expect(lockedAt).not.toBeNull();
      expect(rig.launches).toHaveLength(1);
      expect(rig.launches[0].target).toBe(enemy.mesh);
      // 锁定完成的那一步就发射（state.time 在步末才前进一步）
      expect(Math.abs(rig.launches[0].time + DT - (lockedAt as number))).toBeLessThan(DT / 2);
      expect(rig.missiles()).toBe(2);
    });

    it('shows NO LOCK and spends nothing when the button is let go before the lock', () => {
      const { rig } = trackingRig();

      rig.press(0.1);

      expect(indicator.isLocked()).toBe(false);
      expect(shownCue()).toBe('NO LOCK');
      expect(rig.launches).toHaveLength(0);
      expect(rig.missiles()).toBe(3);
    });

    it('does not launch later, when the lock completes after the button was let go', () => {
      const { rig } = trackingRig();
      rig.press(0.1);

      rig.step(false, 3);

      expect(indicator.isLocked()).toBe(true);
      expect(rig.launches).toHaveLength(0);
      expect(rig.missiles()).toBe(3);
    });

    it('still launches on a fresh press after that lock completed', () => {
      const { rig, enemy } = trackingRig();
      rig.press(0.1);
      rig.step(false, 3);

      rig.press();

      expect(rig.launches).toHaveLength(1);
      expect(rig.launches[0].target).toBe(enemy.mesh);
    });
  });

  describe('with nothing to lock', () => {
    it('shows NO LOCK and spends nothing on a quick press with no target', () => {
      const rig = createRig();
      rig.step(false, 0.5);

      rig.press(0.1);

      expect(shownCue()).toBe('NO LOCK');
      expect(rig.launches).toHaveLength(0);
      expect(rig.missiles()).toBe(3);
    });

    it('shows NO LOCK when the only aircraft is well away from the reticle', () => {
      const rig = createRig();
      const mesh = new THREE.Object3D();
      // 机头右侧 60 度方向
      mesh.position.copy(worldFromLocal(rig.pose, 520, 0, -300));
      rig.enemies.push({
        mesh,
        alive: true,
        isAlive: () => true,
        isCloaked: () => false,
        getMesh: () => mesh,
      });
      rig.step(false, 2);
      expect(indicator.getSeeker().getTarget()).toBeNull();

      rig.press(0.1);

      expect(shownCue()).toBe('NO LOCK');
      expect(rig.launches).toHaveLength(0);
    });

    it('does not launch when a target shows up after the press was let go', () => {
      const rig = createRig();
      rig.press(0.1);

      rig.addEnemyOnNose();
      rig.step(false, 3);

      expect(indicator.isLocked()).toBe(true);
      expect(rig.launches).toHaveLength(0);
    });

    it('shows no cue when the button is never pressed', () => {
      const rig = createRig();

      rig.step(false, 1);

      expect(shownCue()).toBeNull();
    });
  });

  describe('with no missiles left', () => {
    it('shows NO MSL on a press and launches nothing, even with a target on the nose', () => {
      const rig = createRig({ missiles: 0 });
      rig.addEnemyOnNose();
      rig.step(false, 2);
      expect(indicator.isLocked()).toBe(false);

      rig.press(0.1);

      expect(shownCue()).toBe('NO MSL');
      expect(rig.launches).toHaveLength(0);
      expect(rig.missiles()).toBe(0);
    });

    it('launches nothing however long the button is held', () => {
      const rig = createRig({ missiles: 0 });
      rig.addEnemyOnNose();

      rig.step(true, 4);

      expect(rig.launches).toHaveLength(0);
      expect(rig.missiles()).toBe(0);
    });
  });

  describe('multi-shot power-up', () => {
    it('launches more than one missile on a single press, all at the locked target', () => {
      const rig = createRig({ missiles: 3, multiShot: true });
      const enemy = rig.addEnemyOnNose();
      rig.waitForLock();

      rig.step(true);
      rig.flushScheduled();

      expect(rig.launches.length).toBeGreaterThan(1);
      expect(rig.launches.length).toBeLessThanOrEqual(3);
      for (const launch of rig.launches) {
        expect(launch.target).toBe(enemy.mesh);
      }
      expect(rig.missiles()).toBe(3 - rig.launches.length);
    });

    it('spreads the salvo out instead of launching it in one instant', () => {
      const rig = createRig({ missiles: 3, multiShot: true });
      rig.addEnemyOnNose();
      rig.waitForLock();

      rig.step(true);

      expect(rig.launches).toHaveLength(1);
      expect(rig.scheduled.length).toBeGreaterThan(0);
      for (const entry of rig.scheduled) {
        expect(entry.delay).toBeGreaterThan(0);
      }
    });

    it.each([1, 2])('never launches more than the %i missile(s) in stock', (stock) => {
      const rig = createRig({ missiles: stock, multiShot: true });
      rig.addEnemyOnNose();
      rig.waitForLock();

      rig.step(true);
      rig.flushScheduled();

      expect(rig.launches).toHaveLength(stock);
      expect(rig.missiles()).toBe(0);
    });

    it('launches a single missile per press without the power-up', () => {
      const rig = createRig({ missiles: 5, multiShot: false });
      rig.addEnemyOnNose();
      rig.waitForLock();

      rig.step(true);
      rig.flushScheduled();

      expect(rig.launches).toHaveLength(1);
      expect(rig.missiles()).toBe(4);
    });
  });

  describe('launch from the wing pylons', () => {
    function expectedPylon(pose: Pose, side: number): THREE.Vector3 {
      return worldFromLocal(pose, PYLON.x * side, PYLON.y, PYLON.z);
    }

    /** 锁定后隔开发射间隔连发 count 枚 */
    function launchSeries(options: RigOptions, count: number) {
      const rig = createRig({ missiles: 5, ...options });
      rig.addEnemyOnNose();
      rig.waitForLock();
      for (let i = 0; i < count; i += 1) {
        rig.press(0.05);
        rig.step(false, 0.5);
      }
      expect(rig.launches).toHaveLength(count);
      return rig;
    }

    function sideOf(pose: Pose, launch: Launch): number {
      return Math.sign(localFromWorld(pose, launch.position).x);
    }

    it.each(['first-person', 'third-person'] as const)(
      'leaves from (±1.5, -0.2, -1.3) in aircraft space in the %s view',
      (view) => {
        const pose = bankedPose();
        const rig = launchSeries({ pose, view }, 2);

        for (const launch of rig.launches) {
          const local = localFromWorld(pose, launch.position);
          expect(Math.abs(local.x)).toBeCloseTo(PYLON.x, 6);
          expect(local.y).toBeCloseTo(PYLON.y, 6);
          expect(local.z).toBeCloseTo(PYLON.z, 6);
        }
        const used = rig.launches.map((launch) => sideOf(pose, launch)).sort();
        expect(used).toEqual([-1, 1]);
        for (const launch of rig.launches) {
          const expected = expectedPylon(pose, sideOf(pose, launch));
          expect(launch.position.distanceTo(expected)).toBeLessThan(1e-6);
        }
      }
    );

    it('alternates the two pylons launch after launch', () => {
      const pose = bankedPose();
      const rig = launchSeries({ pose }, 5);

      const sides = rig.launches.map((launch) => sideOf(pose, launch));
      expect(Math.abs(sides[0])).toBe(1);
      for (let i = 1; i < sides.length; i += 1) {
        expect(sides[i], `launch ${i + 1}`).toBe(-sides[i - 1]);
      }
    });

    it('uses the same pylon positions in both views', () => {
      const pose = bankedPose();
      const first = launchSeries({ pose, view: 'first-person' }, 2);
      indicator.cancelLockOn();
      const third = launchSeries({ pose, view: 'third-person' }, 2);

      for (let i = 0; i < 2; i += 1) {
        expect(first.launches[i].position.distanceTo(third.launches[i].position)).toBeLessThan(
          1e-6
        );
      }
    });

    it.each(['first-person', 'third-person'] as const)(
      'leaves along the nose direction in the %s view',
      (view) => {
        const pose = bankedPose();
        const rig = launchSeries({ pose, view }, 2);
        const nose = new THREE.Vector3(0, 0, -1).applyQuaternion(pose.quaternion);

        for (const launch of rig.launches) {
          expect(launch.direction.length()).toBeCloseTo(1, 6);
          expect(launch.direction.angleTo(nose)).toBeLessThan(1e-6);
        }
      }
    );

    it('alternates the pylons within a multi-shot salvo too', () => {
      const pose = bankedPose();
      const rig = createRig({ pose, missiles: 3, multiShot: true });
      rig.addEnemyOnNose();
      rig.waitForLock();

      rig.step(true);
      rig.flushScheduled();

      expect(rig.launches.length).toBeGreaterThan(1);
      const sides = rig.launches.map((launch) => sideOf(pose, launch));
      for (let i = 1; i < sides.length; i += 1) {
        expect(sides[i], `launch ${i + 1}`).toBe(-sides[i - 1]);
      }
      for (const launch of rig.launches) {
        const expected = expectedPylon(pose, sideOf(pose, launch));
        expect(launch.position.distanceTo(expected)).toBeLessThan(1e-6);
      }
    });

    it('in level flight is 1.5 m out to one side, 0.2 m below and 1.3 m ahead of the aircraft', () => {
      const pose = levelPose();
      const rig = createRig({ pose, missiles: 5 });
      rig.addEnemyOnNose();
      rig.waitForLock();
      rig.press(0.05);

      // 平飞朝 -Z：前方是 z 减小的方向
      const from = rig.launches[0].position;
      expect(Math.abs(from.x - pose.position.x)).toBeCloseTo(1.5, 6);
      expect(from.y).toBeCloseTo(pose.position.y - 0.2, 6);
      expect(from.z).toBeCloseTo(pose.position.z - 1.3, 6);
    });
  });

  // 导弹继承载机速度（P2）：发射时把载机当前速度交给 MissileSystem.fire 的第四个参数
  describe('launcher speed handed to the missile', () => {
    it.each([22.5, 45, 85, 127.5])(
      'passes the aircraft’s current speed (%s) with the launch',
      (speed) => {
        const rig = createRig({ speed });
        rig.addEnemyOnNose();
        rig.waitForLock();

        rig.press(0.05);

        expect(rig.launches).toHaveLength(1);
        expect(rig.launches[0].launcherSpeed).toBe(speed);
      }
    );

    it('reads the speed at the moment of each launch, not once', () => {
      const rig = createRig({ missiles: 5, speed: 22.5 });
      rig.addEnemyOnNose();
      rig.waitForLock();

      rig.press(0.05);
      rig.state.speed = 45;
      rig.step(false, 0.5);
      rig.press(0.05);

      expect(rig.launches.map((launch) => launch.launcherSpeed)).toEqual([22.5, 45]);
    });

    it('gives every missile of a multi-shot salvo the speed at its own launch', () => {
      const rig = createRig({ missiles: 3, multiShot: true, speed: 30 });
      rig.addEnemyOnNose();
      rig.waitForLock();

      rig.step(true);
      rig.state.speed = 60;
      rig.flushScheduled();

      expect(rig.launches.length).toBeGreaterThan(1);
      expect(rig.launches[0].launcherSpeed).toBe(30);
      for (const launch of rig.launches.slice(1)) {
        expect(launch.launcherSpeed).toBe(60);
      }
    });
  });

  describe('missile stock', () => {
    function reloadRig(missiles: number, reloadTime: number) {
      const presentationController = autoStub();
      const coordinator = coordinatorWith({
        presentationController,
        playerStats: { getMissileReloadTime: () => reloadTime },
        missileCount: missiles,
        missileRespawnTimer: 0,
      });
      const updateMissileHud = presentationController.updateMissileHud as ReturnType<typeof vi.fn>;
      return {
        coordinator,
        run: (seconds: number): number[] => {
          const counts: number[] = [];
          for (let i = 0; i < Math.round(seconds / 0.1); i += 1) {
            callPrivate(coordinator, 'updateMissileRespawn', 0.1);
            counts.push(coordinator.missileCount as number);
          }
          return counts;
        },
        reported: (): Array<{ missileCount: number; missileProgress: number }> =>
          updateMissileHud.mock.calls.map(
            ([, hudState]) => hudState as { missileCount: number; missileProgress: number }
          ),
      };
    }

    it('reloads one missile at a time up to 5 and no further', () => {
      const rig = reloadRig(3, 2);

      const counts = rig.run(60);

      expect(Math.max(...counts)).toBe(5);
      expect(counts[counts.length - 1]).toBe(5);
      let previous = 3;
      for (const count of counts) {
        expect(count - previous === 0 || count - previous === 1).toBe(true);
        previous = count;
      }
    });

    it('reloads from empty', () => {
      const rig = reloadRig(0, 1);

      const counts = rig.run(30);

      expect(counts[0]).toBe(0);
      expect(counts[counts.length - 1]).toBe(5);
    });

    it('never reports more than 5 missiles or a progress outside 0..1 to the HUD', () => {
      const rig = reloadRig(4, 1.5);

      rig.run(30);

      const reported = rig.reported();
      expect(reported.length).toBeGreaterThan(0);
      for (const entry of reported) {
        expect(entry.missileCount).toBeLessThanOrEqual(GAME_CONSTANTS.MISSILE.MAX_MISSILES);
        expect(entry.missileProgress).toBeGreaterThanOrEqual(0);
        expect(entry.missileProgress).toBeLessThanOrEqual(1);
      }
      expect(reported[reported.length - 1].missileCount).toBe(5);
    });

    it.each([0, 1, 5])('gives 3 missiles back on respawn (had %i)', (before) => {
      const unsubscribers: Array<() => void> = [];
      const presentationController = autoStub();
      const coordinator = coordinatorWith({
        resourceRegistry: {
          addUnsubscriber: (unsubscribe: () => void) => unsubscribers.push(unsubscribe),
        },
        hud: autoStub(),
        particleSystem: autoStub(),
        playerAircraft: { visible: false, position: new THREE.Vector3() },
        presentationController,
        audioManager: autoStub(),
        weapons: autoStub(),
        view: autoStub(),
        playerSystem: autoStub(),
        powerUpSystem: autoStub(),
        gameScene: { scene: new THREE.Scene() },
        missileCount: before,
      });
      callPrivate(coordinator, 'setupEventListeners');

      EventBus.emit(GameEventType.PLAYER_RESPAWN, { position: new THREE.Vector3(0, 300, 0) });

      expect(coordinator.missileCount).toBe(3);
      const updateMissileHud = presentationController.updateMissileHud as ReturnType<typeof vi.fn>;
      const reported = updateMissileHud.mock.calls.map(
        ([, hudState]) => (hudState as { missileCount: number }).missileCount
      );
      expect(reported[reported.length - 1]).toBe(3);
      for (const unsubscribe of unsubscribers) unsubscribe();
    });

    it.each([0, 5])('starts a mission with 3 missiles (the previous run ended on %i)', (before) => {
      const presentationController = autoStub();
      const fields: Stub = { presentationController, missileCount: before };

      callPrivate(looseCoordinator(fields), 'startInternal');

      expect(fields.missileCount).toBe(3);
      const updateMissileHud = presentationController.updateMissileHud as ReturnType<typeof vi.fn>;
      const reported = updateMissileHud.mock.calls.map(
        ([, hudState]) => (hudState as { missileCount: number }).missileCount
      );
      expect(reported[reported.length - 1]).toBe(3);
    });
  });

  describe('aim reticle visibility', () => {
    function gunCrossShown(): boolean {
      return isShown(chrome('gun-cross'));
    }

    function renderRig() {
      const rig = createRig();
      const render = (): void => {
        callPrivate(rig.coordinator, 'renderAimHud', 1);
      };
      render();
      expect(gunCrossShown(), 'the gun cross shows while flying').toBe(true);
      return { rig, render };
    }

    it('is shown while the mission is being flown', () => {
      renderRig();
    });

    it('is hidden when the game is not being played', () => {
      const { rig, render } = renderRig();

      rig.state.playing = false;
      render();

      expect(gunCrossShown()).toBe(false);
    });

    it('is hidden while paused', () => {
      const { rig, render } = renderRig();

      rig.state.paused = true;
      render();

      expect(gunCrossShown()).toBe(false);
    });

    it('is hidden during a story hold', () => {
      const { rig, render } = renderRig();

      rig.coordinator.storyHold = true;
      render();

      expect(gunCrossShown()).toBe(false);
    });

    it('is hidden while the aircraft is hidden', () => {
      const { rig, render } = renderRig();

      rig.aircraft.visible = false;
      render();

      expect(gunCrossShown()).toBe(false);
    });

    it('is hidden while the player is respawning', () => {
      const { rig, render } = renderRig();

      rig.state.respawning = true;
      render();

      expect(gunCrossShown()).toBe(false);
    });

    it('comes back when play resumes', () => {
      const { rig, render } = renderRig();
      rig.state.paused = true;
      render();
      expect(gunCrossShown()).toBe(false);

      rig.state.paused = false;
      render();

      expect(gunCrossShown()).toBe(true);
    });
  });
});
