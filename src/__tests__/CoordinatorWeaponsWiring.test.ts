import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_CONSTANTS, GameConfig } from '@/config';
import type { SpecialWeaponId } from '@/core/CombatContracts';
import { EventBus, GameEventType } from '@/core/EventBus';
import { GameCoordinator } from '@/core/GameCoordinator';
import { PlayerSystem } from '@/core/systems/PlayerSystem';
import { GunLeadSolver } from '@/features/combat/GunLeadSolver';
import { PlayerStats } from '@/features/upgrade/UpgradeSystem';
import { LockOnIndicator } from '@/ui/LockOnIndicator';
import { resetLocale } from './i18nTestUtils';

/**
 * 协调器的武器接线（GameCoordinator）：
 * - C2 / C3 / C4：每个模拟步把解算器的辅助方向与强度交给 PlayerSystem，渲染帧把同一个方向交给
 *   准星——十字落在哪里，子弹就打向哪里。用哪一档锥角只看设备：GameConfig.isMobile 为真用触屏档
 *   （2.5° 以内全量，到 5° 减到零；接了实体键盘也一样），其余设备用键盘档（1.25° 以内全量，
 *   到 2.5° 减到零，偏移不超过 1.25°）。提前量标记、机头标记和以机头轴线为圆心的捕获环两边相同；
 * - 敌机编队第 2 批：隐身中的敌机没有提前量标记，也拿不到机炮辅助，现形之后照常；
 * - C5：第一人称下特殊武器的枪口焰和电磁炮闪屏缩到约 0.55，第三人称不变；
 * - C5：暂停菜单拿到 getSaveStatus 与 onSaveAndExit，对局不在进行时两者都报“不存档”。
 *
 * 协调器整体依赖 WebGL，这里沿用 CoordinatorWiring.test.ts 的做法：以 GameCoordinator 原型为原型
 * 造一个对象，只给被测私有方法用到的字段。机炮这条链路上的 PlayerSystem、GunLeadSolver 和
 * LockOnIndicator 都是真的；飞控、特殊武器控制器和暂停菜单换成替身。
 */

const captured = vi.hoisted(() => ({
  weaponOptions: [] as unknown[],
  pauseOptions: [] as unknown[],
}));

// 飞控换成只报位姿的替身：机体停在测试摆好的位置和姿态上
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
      // 机体不动
    }

    dispose(): void {
      // 没有要清理的
    }
  },
}));

// 特殊武器控制器：只记下协调器交给它的回调
vi.mock('@/core/combat/SpecialWeaponsController', () => ({
  SpecialWeaponsController: class {
    constructor(options: unknown) {
      captured.weaponOptions.push(options);
    }
  },
}));

// 暂停菜单：只记下协调器交给它的回调
vi.mock('@/ui/PauseMenu', () => ({
  PauseMenu: class {
    constructor(options: unknown) {
      captured.pauseOptions.push(options);
    }

    dispose(): void {
      // 没有要清理的
    }
  },
}));

type Stub = Record<string, unknown>;

interface Pose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

interface Pixel {
  x: number;
  y: number;
}

interface Shot {
  position: THREE.Vector3;
  direction: THREE.Vector3;
}

/** 一架普通敌机：活着、没有隐身；cloaked 置真就是一架隐身中的幽灵机 */
interface FakeEnemy {
  mesh: THREE.Object3D;
  alive: boolean;
  cloaked: boolean;
  isAlive: () => boolean;
  isCloaked: () => boolean;
  getMesh: () => THREE.Object3D;
}

type ViewName = 'first-person' | 'third-person';

const DT = 1 / 60;
const VIEWPORT = { width: 1280, height: 800 };
const EYE_OFFSET = new THREE.Vector3(0, 0.46, -0.8);
const CHASE_OFFSET = new THREE.Vector3(
  GAME_CONSTANTS.CAMERA.OFFSET.x,
  GAME_CONSTANTS.CAMERA.OFFSET.y,
  GAME_CONSTANTS.CAMERA.OFFSET.z
);
/** 足够让速度估计可靠、并让滑动结束的步数（1.5 秒） */
const SETTLE_STEPS = 90;

const rad = THREE.MathUtils.degToRad;

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

/** 以 GameCoordinator 原型为原型、字段由测试提供的对象 */
function coordinatorWith(fields: Stub): Stub {
  const target = Object.create(GameCoordinator.prototype) as Stub;
  Object.assign(target, fields);
  return target;
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
      new THREE.Euler(rad(12), rad(-35), rad(25), 'YXZ')
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

function toPixel(world: THREE.Vector3, camera: THREE.Camera): Pixel {
  const ndc = world.clone().project(camera);
  return {
    x: (ndc.x + 1) * 0.5 * VIEWPORT.width,
    y: (1 - ndc.y) * 0.5 * VIEWPORT.height,
  };
}

function pixelDistance(a: Pixel, b: Pixel): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 点 p 到线段 ab 的屏幕距离（像素） */
function distanceToSegment(p: Pixel, a: Pixel, b: Pixel): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  const t =
    lengthSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSq));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}

function angleBetween(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.atan2(a.clone().cross(b).length(), a.dot(b));
}

/** 子弹弹道（从 shot.position 沿 shot.direction 的射线）离 point 最近多少米 */
function missDistance(shot: Shot, point: THREE.Vector3): number {
  const toPoint = point.clone().sub(shot.position);
  const along = Math.max(0, toPoint.dot(shot.direction));
  return toPoint.addScaledVector(shot.direction, -along).length();
}

function lockRoot(): HTMLElement {
  const root = document.getElementById('lock-on-indicator');
  expect(root, 'expected #lock-on-indicator in the document').toBeTruthy();
  return root as HTMLElement;
}

function reticleFlag(): string | null {
  const reticle = lockRoot().querySelector('[data-lock-anchor="reticle"]');
  expect(reticle, 'expected the reticle anchor').toBeTruthy();
  return (reticle as Element).getAttribute('data-gun-assist');
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

function leadMarkerShown(): boolean {
  const marker = lockRoot().querySelector('[data-lock-anchor="lead"]');
  expect(marker, 'expected the lead marker anchor').toBeTruthy();
  return isShown(marker as Element);
}

/** 准星上的一个部件：acquire-ring（捕获环）、nose-mark（机头标记）、gun-cross（机炮十字） */
function lockChrome(name: string): HTMLElement {
  const matches = lockRoot().querySelectorAll<HTMLElement>(`[data-lock-chrome="${name}"]`);
  expect(matches.length, `expected exactly one [data-lock-chrome="${name}"]`).toBe(1);
  return matches[0];
}

/** 元素（及祖先）内联 transform 里的平移之和 = 它的锚点在视口里的像素位置 */
function screenPositionOf(element: Element): Pixel {
  const position = { x: 0, y: 0 };
  const root = lockRoot();
  for (let node: Element | null = element; node && node !== root; node = node.parentElement) {
    const transform = (node as HTMLElement).style?.transform ?? '';
    const match = transform.match(/translate(?:3d)?\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px/);
    if (match) {
      position.x += Number(match[1]);
      position.y += Number(match[2]);
    }
  }
  return position;
}

describe('GameCoordinator weapons wiring', () => {
  let originalIsMobile: boolean;
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeEach(() => {
    originalIsMobile = GameConfig.isMobile;
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: VIEWPORT.width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: VIEWPORT.height });
    document.body.innerHTML = '';
    EventBus.clear();
    captured.weaponOptions.length = 0;
    captured.pauseOptions.length = 0;
  });

  afterEach(() => {
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

  describe('gun aim assist: the cross and the bullets', () => {
    let indicator: LockOnIndicator;
    let random: ReturnType<typeof vi.spyOn>;
    let now: ReturnType<typeof vi.spyOn>;
    let nowMs: number;

    beforeEach(() => {
      nowMs = 10_000;
      now = vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
      // 0.5 = 没有散布：看的是弹道的中心线
      random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    afterEach(() => {
      indicator?.dispose();
      random.mockRestore();
      now.mockRestore();
    });

    interface GunRigOptions {
      touch: boolean;
      pose?: Pose;
      view?: ViewName;
    }

    function createGunRig(options: GunRigOptions) {
      GameConfig.isMobile = options.touch;
      indicator = new LockOnIndicator();
      indicator.init();

      const pose = options.pose ?? levelPose();
      const camera = options.view === 'third-person' ? chaseCamera(pose) : eyeCamera(pose);
      const aircraft = new THREE.Group();
      aircraft.position.copy(pose.position);
      aircraft.quaternion.copy(pose.quaternion);
      const playerSystem = new PlayerSystem(new THREE.Scene(), aircraft, new PlayerStats());
      playerSystem.init();
      const nose = new THREE.Vector3(0, 0, -1).applyQuaternion(pose.quaternion);

      const shots: Shot[] = [];
      EventBus.on(GameEventType.PLAYER_FIRED, (event) => {
        shots.push({
          position: event.payload.position.clone(),
          direction: event.payload.direction.clone(),
        });
      });

      const enemies: FakeEnemy[] = [];
      const unitAimObjects: THREE.Object3D[] = [];
      const unitDomains = new Map<THREE.Object3D, string>();
      const state = { playing: true, paused: false, storyHold: false };
      const solver = new GunLeadSolver();
      const coordinator = coordinatorWith({
        lockOnIndicator: indicator,
        presentationRuntimeReady: true,
        sessionState: {
          isPlaying: () => state.playing,
          isPaused: () => state.paused,
        },
        storyHold: false,
        enemySystem: { getEnemies: () => enemies },
        units: {
          getSystem: () =>
            unitAimObjects.length > 0
              ? {
                  findByMesh: (object: THREE.Object3D) => {
                    const domain = unitDomains.get(object);
                    return domain ? { domain } : undefined;
                  },
                }
              : null,
          collectLockTargets: (out: THREE.Object3D[]) => {
            out.push(...unitAimObjects);
          },
        },
        lockTargets: [],
        gunTargets: [],
        gunSurfaceTargets: [],
        gunForward: new THREE.Vector3(),
        gunMuzzle: new THREE.Vector3(),
        gunLeadSolver: solver,
        gunLeadPoint: new THREE.Vector3(),
        playerAircraft: aircraft,
        playerSystem,
        gameScene: { camera },
        interpolatedCameraTargetPosition: pose.position,
        interpolatedCameraTargetQuaternion: pose.quaternion,
        missilePressArmed: false,
        missileRearmTimer: 0,
      });

      /** 开一枪（等冷却转好），返回它的发射位置与方向 */
      const shoot = (): Shot => {
        playerSystem.update(1);
        expect(playerSystem.canFire(), 'the gun should be ready to fire').toBe(true);
        const before = shots.length;
        playerSystem.fire();
        expect(shots.length, 'one shot per trigger pull').toBe(before + 1);
        return shots[shots.length - 1];
      };
      /** 炮口：一发不带辅助的子弹的发射位置 */
      const muzzle = shoot().position.clone();

      /** 离机头轴线 degrees 度（bearing：0 = 机体右侧，90 = 上方）、距炮口 range 米的世界坐标 */
      const pointOffNose = (degrees: number, range: number, bearing = 0): THREE.Vector3 =>
        new THREE.Vector3(
          Math.sin(rad(degrees)) * Math.cos(rad(bearing)),
          Math.sin(rad(degrees)) * Math.sin(rad(bearing)),
          -Math.cos(rad(degrees))
        )
          .multiplyScalar(range)
          .applyQuaternion(pose.quaternion)
          .add(muzzle);

      const addEnemy = (position: THREE.Vector3): FakeEnemy => {
        const mesh = new THREE.Object3D();
        mesh.position.copy(position);
        const enemy: FakeEnemy = {
          mesh,
          alive: true,
          cloaked: false,
          isAlive: () => enemy.alive,
          isCloaked: () => enemy.cloaked,
          getMesh: () => mesh,
        };
        enemies.push(enemy);
        return enemy;
      };

      const addUnit = (position: THREE.Vector3, domain: 'air' | 'ground' | 'sea') => {
        const aimObject = new THREE.Object3D();
        aimObject.position.copy(position);
        unitAimObjects.push(aimObject);
        unitDomains.set(aimObject, domain);
        return aimObject;
      };

      /** 一个模拟步 + 一个渲染帧 */
      const step = (alpha = 1): void => {
        callPrivate(coordinator, 'updateGunAim', DT);
        callPrivate(coordinator, 'renderAimHud', alpha);
        nowMs += DT * 1000;
      };
      const run = (steps = SETTLE_STEPS): void => {
        for (let i = 0; i < steps; i += 1) step();
      };
      const render = (alpha = 1): void => {
        (coordinator as { storyHold: boolean }).storyHold = state.storyHold;
        callPrivate(coordinator, 'renderAimHud', alpha);
      };

      const cross = (): Pixel => {
        const screen = indicator.getGunCrossScreen();
        expect(screen.visible, 'the gun cross should be on screen').toBe(true);
        return { x: screen.x, y: screen.y };
      };
      const nosePixel = (): Pixel => {
        const screen = indicator.getAimScreen();
        expect(screen.visible, 'the reticle should be on screen').toBe(true);
        return { x: screen.x, y: screen.y };
      };

      return {
        coordinator,
        pose,
        camera,
        aircraft,
        playerSystem,
        solver,
        nose,
        muzzle,
        state,
        shoot,
        pointOffNose,
        addEnemy,
        addUnit,
        step,
        run,
        render,
        cross,
        nosePixel,
      };
    }

    const SETUPS = [
      ['first person, level', 'first-person', levelPose],
      ['first person, banked', 'first-person', bankedPose],
      ['chase view, level', 'third-person', levelPose],
      ['chase view, banked', 'third-person', bankedPose],
    ] as const;

    describe('on a touch device', () => {
      it.each(SETUPS)(
        'pulls the cross onto an enemy 2.4° off the nose and puts the bullet through it (%s)',
        (_name, view, makePose) => {
          const rig = createGunRig({ touch: true, view, pose: makePose() });
          const enemy = rig.addEnemy(rig.pointOffNose(2.4, 300, 40));

          rig.run();
          const shot = rig.shoot();

          // 子弹从炮口出发、正对敌机（不是从机体中心算出来的方向）
          expect(missDistance(shot, enemy.mesh.position)).toBeLessThan(0.02);
          // 十字就画在敌机身上
          const onEnemy = toPixel(enemy.mesh.position, rig.camera);
          expect(pixelDistance(rig.cross(), onEnemy)).toBeLessThan(1.5);
          expect(pixelDistance(rig.cross(), rig.nosePixel())).toBeGreaterThan(10);
          expect(reticleFlag()).toBe('true');
        }
      );

      it.each(SETUPS)(
        'shows the cross on the path the bullet takes while the assist fades (%s)',
        (_name, view, makePose) => {
          const rig = createGunRig({ touch: true, view, pose: makePose() });
          // 3.7°：偏移只有一部分，十字不在敌机身上，但仍然在弹道上
          const enemy = rig.addEnemy(rig.pointOffNose(3.7, 280, 200));

          rig.run();
          const shot = rig.shoot();

          const along = (range: number): Pixel =>
            toPixel(shot.position.clone().addScaledVector(shot.direction, range), rig.camera);
          expect(distanceToSegment(rig.cross(), along(100), along(600))).toBeLessThan(1);
          expect(pixelDistance(rig.cross(), rig.nosePixel())).toBeGreaterThan(3);
          expect(
            pixelDistance(rig.cross(), toPixel(enemy.mesh.position, rig.camera))
          ).toBeGreaterThan(5);
          expect(angleBetween(shot.direction, rig.nose)).toBeGreaterThan(rad(0.3));
        }
      );

      it('keeps cross and bullet together on every step while the assist slides in', () => {
        const rig = createGunRig({ touch: true });
        rig.addEnemy(rig.pointOffNose(2, 300));

        let shifted = 0;
        for (let i = 0; i < 24; i += 1) {
          rig.step();
          const shot = rig.shoot();
          const onPath = toPixel(
            shot.position.clone().addScaledVector(shot.direction, 400),
            rig.camera
          );
          expect(pixelDistance(rig.cross(), onPath), `step ${i}`).toBeLessThan(1);
          if (pixelDistance(rig.cross(), rig.nosePixel()) > 1) shifted += 1;
        }
        expect(shifted).toBeGreaterThan(10);
      });

      it('draws the cross between two steps where the previous step left it (alpha 0)', () => {
        const rig = createGunRig({ touch: true });
        rig.addEnemy(rig.pointOffNose(2.4, 300));

        let moved = 0;
        let previous: Pixel | null = null;
        for (let i = 0; i < 16; i += 1) {
          callPrivate(rig.coordinator, 'updateGunAim', DT);
          rig.render(0);
          const atStart = rig.cross();
          if (previous) expect(pixelDistance(atStart, previous), `step ${i}`).toBeLessThan(0.5);
          rig.render(1);
          const atEnd = rig.cross();
          moved = Math.max(moved, pixelDistance(atStart, atEnd));
          previous = atEnd;
        }
        // 滑动途中，一步之内十字确实在动
        expect(moved).toBeGreaterThan(2);
      });

      it('narrows the bullet spread while it holds the target', () => {
        const rig = createGunRig({ touch: true });
        rig.addEnemy(rig.pointOffNose(1.5, 300));
        rig.run();

        const centre = rig.shoot().direction;
        random.mockReturnValue(0);
        const edge = rig.shoot().direction;

        expect(THREE.MathUtils.radToDeg(angleBetween(edge, centre))).toBeCloseTo(0.6, 2);
      });

      it('narrows the spread only part of the way while the assist fades', () => {
        const rig = createGunRig({ touch: true });
        rig.addEnemy(rig.pointOffNose(3.75, 300));
        rig.run();

        const centre = rig.shoot().direction;
        random.mockReturnValue(0);
        const edge = rig.shoot().direction;

        const half = THREE.MathUtils.radToDeg(angleBetween(edge, centre));
        expect(half).toBeGreaterThan(0.65);
        expect(half).toBeLessThan(1.45);
      });

      it('assists on a ground unit’s aim point but offers no lead marker for it', () => {
        const rig = createGunRig({ touch: true });
        const aimObject = rig.addUnit(rig.pointOffNose(2, 300, 270), 'ground');

        rig.run();
        const shot = rig.shoot();

        expect(missDistance(shot, aimObject.position)).toBeLessThan(0.02);
        expect(pixelDistance(rig.cross(), toPixel(aimObject.position, rig.camera))).toBeLessThan(
          1.5
        );
        expect(leadMarkerShown()).toBe(false);
      });

      it('assists on a sea unit’s aim point too', () => {
        const rig = createGunRig({ touch: true });
        const aimObject = rig.addUnit(rig.pointOffNose(1.2, 420, 180), 'sea');

        rig.run();

        expect(missDistance(rig.shoot(), aimObject.position)).toBeLessThan(0.02);
        expect(leadMarkerShown()).toBe(false);
      });

      it('assists on an air unit and gives it a lead marker like any aircraft', () => {
        const rig = createGunRig({ touch: true });
        const aimObject = rig.addUnit(rig.pointOffNose(2, 300, 90), 'air');

        rig.run();

        expect(missDistance(rig.shoot(), aimObject.position)).toBeLessThan(0.02);
        expect(leadMarkerShown()).toBe(true);
      });

      it('lists aircraft ahead of surface units whatever order the units come in', () => {
        const rig = createGunRig({ touch: true });
        // 地面单位先登记、空中单位后登记；两者都在机头附近，都该被解算
        const ground = rig.addUnit(rig.pointOffNose(4.5, 300, 180), 'ground');
        const air = rig.addUnit(rig.pointOffNose(8, 300, 0), 'air');

        rig.run();

        // 只有空中目标能拿到提前量标记
        expect(rig.solver.getPipTarget()).toBe(air);
        expect(rig.solver.getAssistTarget()).toBe(ground);
      });

      it('ignores an enemy that is no longer alive', () => {
        const rig = createGunRig({ touch: true });
        const enemy = rig.addEnemy(rig.pointOffNose(2, 300));
        enemy.alive = false;

        rig.run();

        expect(angleBetween(rig.shoot().direction, rig.nose)).toBeLessThan(1e-9);
        expect(pixelDistance(rig.cross(), rig.nosePixel())).toBeLessThan(1e-6);
        expect(reticleFlag()).toBe('false');
      });

      it('leaves the cross on the nose for an enemy 6° off the nose', () => {
        const rig = createGunRig({ touch: true });
        rig.addEnemy(rig.pointOffNose(6, 300));

        rig.run();

        expect(angleBetween(rig.shoot().direction, rig.nose)).toBeLessThan(1e-9);
        expect(pixelDistance(rig.cross(), rig.nosePixel())).toBeLessThan(1e-6);
        expect(reticleFlag()).toBe('false');
      });

      it('leaves the cross on the nose for an enemy beyond 480 m', () => {
        const rig = createGunRig({ touch: true, view: 'third-person' });
        rig.addEnemy(rig.pointOffNose(1.5, 490));

        rig.run();

        expect(angleBetween(rig.shoot().direction, rig.nose)).toBeLessThan(1e-9);
        expect(pixelDistance(rig.cross(), rig.nosePixel())).toBeLessThan(1e-6);
        expect(reticleFlag()).toBe('false');
      });
    });

    // 桌面（键盘）：同一套辅助，锥角小一半——瞄准点离机头 1.25° 以内全量，到 2.5° 减到零
    describe('on a desktop', () => {
      it.each(SETUPS)(
        'pulls the cross onto an enemy 1° off the nose and puts the bullet through it (%s)',
        (_name, view, makePose) => {
          const rig = createGunRig({ touch: false, view, pose: makePose() });
          const enemy = rig.addEnemy(rig.pointOffNose(1, 300, 40));

          rig.run();
          const shot = rig.shoot();

          // 子弹从炮口出发、正对敌机
          expect(missDistance(shot, enemy.mesh.position)).toBeLessThan(0.02);
          // 十字就画在敌机身上
          const onEnemy = toPixel(enemy.mesh.position, rig.camera);
          expect(pixelDistance(rig.cross(), onEnemy)).toBeLessThan(1.5);
          expect(pixelDistance(rig.cross(), rig.nosePixel())).toBeGreaterThan(5);
          expect(reticleFlag()).toBe('true');
        }
      );

      it.each(SETUPS)(
        'goes only part of the way to an enemy 2° off the nose, the cross staying on the bullet’s path (%s)',
        (_name, view, makePose) => {
          const rig = createGunRig({ touch: false, view, pose: makePose() });
          const enemy = rig.addEnemy(rig.pointOffNose(2, 300, 200));

          rig.run();
          const shot = rig.shoot();

          const along = (range: number): Pixel =>
            toPixel(shot.position.clone().addScaledVector(shot.direction, range), rig.camera);
          expect(distanceToSegment(rig.cross(), along(100), along(600))).toBeLessThan(1);
          // 子弹离开了机头轴线，但转过去的不到 1.25°，也没有到敌机那里
          const turned = angleBetween(shot.direction, rig.nose);
          expect(turned).toBeGreaterThan(rad(0.1));
          expect(turned).toBeLessThan(rad(1.25));
          expect(missDistance(shot, enemy.mesh.position)).toBeGreaterThan(3);
          expect(
            pixelDistance(rig.cross(), toPixel(enemy.mesh.position, rig.camera))
          ).toBeGreaterThan(5);
        }
      );

      it.each([1.3, 1.6, 2, 2.4])(
        'never turns the bullets as much as 1.25° for an enemy %s° off the nose',
        (degrees) => {
          const rig = createGunRig({ touch: false });
          rig.addEnemy(rig.pointOffNose(degrees, 300, 130));

          let turned = 0;
          for (let i = 0; i < SETTLE_STEPS; i += 1) {
            rig.step();
            turned = angleBetween(rig.shoot().direction, rig.nose);
            expect(turned, `step ${i}`).toBeLessThan(rad(1.25));
          }
          // 滑动结束后子弹确实偏向了敌机
          expect(turned).toBeGreaterThan(rad(0.01));
        }
      );

      it.each([2.6, 3.5, 4.5])(
        'leaves the cross and the bullets on the nose for an enemy %s° off the nose',
        (degrees) => {
          const rig = createGunRig({ touch: false });
          rig.addEnemy(rig.pointOffNose(degrees, 300, 40));

          for (let i = 0; i < SETTLE_STEPS; i += 1) {
            rig.step();
            expect(pixelDistance(rig.cross(), rig.nosePixel()), `step ${i}`).toBeLessThan(1e-6);
            expect(reticleFlag(), `step ${i}`).toBe('false');
          }
          expect(angleBetween(rig.shoot().direction, rig.nose)).toBeLessThan(1e-9);
        }
      );

      it('leaves the cross on the nose for an enemy beyond 480 m', () => {
        const rig = createGunRig({ touch: false, view: 'third-person' });
        rig.addEnemy(rig.pointOffNose(0.8, 490));

        rig.run();

        expect(angleBetween(rig.shoot().direction, rig.nose)).toBeLessThan(1e-9);
        expect(pixelDistance(rig.cross(), rig.nosePixel())).toBeLessThan(1e-6);
        expect(reticleFlag()).toBe('false');
      });

      it('keeps cross and bullet together on every step while the assist slides in', () => {
        const rig = createGunRig({ touch: false });
        rig.addEnemy(rig.pointOffNose(1.2, 300));

        let shifted = 0;
        for (let i = 0; i < 24; i += 1) {
          rig.step();
          const shot = rig.shoot();
          const onPath = toPixel(
            shot.position.clone().addScaledVector(shot.direction, 400),
            rig.camera
          );
          expect(pixelDistance(rig.cross(), onPath), `step ${i}`).toBeLessThan(1);
          if (pixelDistance(rig.cross(), rig.nosePixel()) > 1) shifted += 1;
        }
        expect(shifted).toBeGreaterThan(10);
      });

      it('narrows the bullet spread while it holds the target', () => {
        const rig = createGunRig({ touch: false });
        rig.addEnemy(rig.pointOffNose(1, 300));
        rig.run();

        const centre = rig.shoot().direction;
        random.mockReturnValue(0);
        const edge = rig.shoot().direction;

        expect(THREE.MathUtils.radToDeg(angleBetween(edge, centre))).toBeCloseTo(0.6, 2);
      });

      it('narrows the spread only part of the way while the assist fades', () => {
        const rig = createGunRig({ touch: false });
        rig.addEnemy(rig.pointOffNose(1.875, 300));
        rig.run();

        const centre = rig.shoot().direction;
        random.mockReturnValue(0);
        const edge = rig.shoot().direction;

        const half = THREE.MathUtils.radToDeg(angleBetween(edge, centre));
        expect(half).toBeGreaterThan(0.65);
        expect(half).toBeLessThan(1.45);
      });

      it('keeps the full 3° spread next to an enemy outside its cone', () => {
        const rig = createGunRig({ touch: false });
        // 3°：触屏档会收窄散布，键盘档不会
        rig.addEnemy(rig.pointOffNose(3, 300));
        rig.run();

        const centre = rig.shoot().direction;
        random.mockReturnValue(0);
        const edge = rig.shoot().direction;

        expect(THREE.MathUtils.radToDeg(angleBetween(edge, centre))).toBeCloseTo(1.5, 6);
      });

      it('assists on a ground unit’s aim point but offers no lead marker for it', () => {
        const rig = createGunRig({ touch: false });
        const aimObject = rig.addUnit(rig.pointOffNose(1, 300, 270), 'ground');

        rig.run();
        const shot = rig.shoot();

        expect(missDistance(shot, aimObject.position)).toBeLessThan(0.02);
        expect(pixelDistance(rig.cross(), toPixel(aimObject.position, rig.camera))).toBeLessThan(
          1.5
        );
        expect(leadMarkerShown()).toBe(false);
      });

      it.each(SETUPS)(
        'keeps the reticle, the lock ring and the nose marker on the nose axis while the cross is pulled away (%s)',
        (_name, view, makePose) => {
          const rig = createGunRig({ touch: false, view, pose: makePose() });
          rig.step();
          const noseMark = lockChrome('nose-mark');
          const before = {
            aim: { ...rig.nosePixel() },
            ring: screenPositionOf(lockChrome('acquire-ring')),
            radius: indicator.getAcquireRadius(),
          };
          expect(pixelDistance(rig.cross(), rig.nosePixel())).toBeLessThan(1e-6);
          expect(getComputedStyle(noseMark).display).toBe('none');

          rig.addEnemy(rig.pointOffNose(1.2, 300, 40));
          rig.run();

          expect(pixelDistance(rig.cross(), rig.nosePixel())).toBeGreaterThan(5);
          // 准星锚点和捕获环没有跟着十字走，环也没有变大变小
          expect(rig.nosePixel()).toEqual(before.aim);
          expect(screenPositionOf(lockChrome('acquire-ring'))).toEqual(before.ring);
          expect(indicator.getAcquireRadius()).toBe(before.radius);
          // 它们在真正的机头轴线上：机头前方 600 米那一点
          const trueNose = toPixel(
            rig.pose.position.clone().addScaledVector(rig.nose, 600),
            rig.camera
          );
          expect(pixelDistance(rig.nosePixel(), trueNose)).toBeLessThan(0.5);
          expect(
            pixelDistance(screenPositionOf(lockChrome('acquire-ring')), trueNose)
          ).toBeLessThan(0.5);
          // 机头标记亮出来，留在机头轴线上
          expect(getComputedStyle(noseMark).display).not.toBe('none');
          expect(pixelDistance(screenPositionOf(noseMark), trueNose)).toBeLessThan(0.5);
        }
      );

      it.each([2, 4])('still offers the lead marker (enemy %s° off the nose)', (degrees) => {
        const rig = createGunRig({ touch: false });
        const enemy = rig.addEnemy(rig.pointOffNose(degrees, 300));

        rig.run();

        expect(rig.solver.getPipTarget()).toBe(enemy.mesh);
        expect(leadMarkerShown()).toBe(true);
      });
    });

    // 用哪一档只看 GameConfig.isMobile：同一块屏幕、同一架敌机，只换这个标志。
    // 触屏设备接了实体键盘也仍然是触屏档——协调器不看别的
    describe('the device decides the cone', () => {
      it.each([
        // 敌机离机头的角度、设备、子弹转向敌机的角度下限与上限（度）
        [1, 'touch', 1, 1],
        [1, 'desktop', 1, 1],
        [1.2, 'desktop', 1.2, 1.2],
        [2, 'touch', 2, 2],
        [2, 'desktop', 0.1, 1.24],
        [4, 'touch', 0.1, 2.5],
        [4, 'desktop', 0, 0],
      ] as const)(
        'an enemy %s° off the nose on a %s device: the bullets turn %s° to %s° towards it',
        (degrees, device, atLeast, atMost) => {
          const rig = createGunRig({ touch: device === 'touch' });
          rig.addEnemy(rig.pointOffNose(degrees, 300, 40));

          rig.run();
          const turned = THREE.MathUtils.radToDeg(angleBetween(rig.shoot().direction, rig.nose));

          expect(turned).toBeGreaterThanOrEqual(atLeast - 1e-6);
          expect(turned).toBeLessThanOrEqual(atMost + 1e-6);
        }
      );
    });

    // 隐身（敌机编队规格 §3 WRAITH）：隐身期间“不能被锁定，没有雷达光点、血条、目标标记，
    // 也没有机炮提前量标记”。机炮辅助也不把十字拉向一架看不见的敌机；一现形就照常。
    // 隐身的时序（何时隐、何时现）不在这里：替身敌机的 cloaked 直接给出“此刻是否隐身”。
    describe('a cloaked jet', () => {
      // 设备、是否触屏、落在该设备全量辅助区里的偏角（度）
      const DEVICES = [
        ['touch', true, 2],
        ['desktop', false, 1],
      ] as const;

      it.each(DEVICES)('gets no lead marker on a %s device', (_device, touch, degrees) => {
        const rig = createGunRig({ touch });
        const enemy = rig.addEnemy(rig.pointOffNose(degrees, 300, 40));
        enemy.cloaked = true;

        rig.run();

        expect(leadMarkerShown()).toBe(false);
        expect(rig.solver.getPipTarget()).toBeNull();
      });

      it.each(DEVICES)(
        'does not pull the cross or the bullets on a %s device',
        (_device, touch, degrees) => {
          const rig = createGunRig({ touch });
          const enemy = rig.addEnemy(rig.pointOffNose(degrees, 300, 40));
          enemy.cloaked = true;

          rig.run();

          expect(angleBetween(rig.shoot().direction, rig.nose)).toBeLessThan(1e-9);
          expect(pixelDistance(rig.cross(), rig.nosePixel())).toBeLessThan(1e-6);
          expect(reticleFlag()).toBe('false');
          expect(rig.solver.getAssistTarget()).toBeNull();
        }
      );

      it.each(DEVICES)(
        'keeps the full 3° spread next to it on a %s device',
        (_device, touch, degrees) => {
          const rig = createGunRig({ touch });
          const enemy = rig.addEnemy(rig.pointOffNose(degrees, 300));
          enemy.cloaked = true;
          rig.run();

          const centre = rig.shoot().direction;
          random.mockReturnValue(0);
          const edge = rig.shoot().direction;

          expect(THREE.MathUtils.radToDeg(angleBetween(edge, centre))).toBeCloseTo(1.5, 6);
        }
      );

      it.each(DEVICES)(
        'loses the lead marker on the step it cloaks, and the cross goes back to the nose (%s)',
        (_device, touch, degrees) => {
          const rig = createGunRig({ touch });
          const enemy = rig.addEnemy(rig.pointOffNose(degrees, 300, 40));
          rig.run();
          expect(leadMarkerShown()).toBe(true);
          expect(pixelDistance(rig.cross(), rig.nosePixel())).toBeGreaterThan(5);
          expect(missDistance(rig.shoot(), enemy.mesh.position)).toBeLessThan(0.02);

          enemy.cloaked = true;
          rig.step();

          expect(leadMarkerShown()).toBe(false);
          expect(rig.solver.getPipTarget()).toBeNull();
          expect(rig.solver.getAssistTarget()).toBeNull();

          // 十字不必瞬间跳回去，但半秒之内回到机头，子弹也沿机头飞
          rig.run(30);
          expect(pixelDistance(rig.cross(), rig.nosePixel())).toBeLessThan(1e-6);
          expect(reticleFlag()).toBe('false');
          expect(angleBetween(rig.shoot().direction, rig.nose)).toBeLessThan(1e-9);
        }
      );

      it.each(DEVICES)('is picked up again once it is visible (%s)', (_device, touch, degrees) => {
        const rig = createGunRig({ touch });
        const enemy = rig.addEnemy(rig.pointOffNose(degrees, 300, 40));
        enemy.cloaked = true;
        rig.run();
        expect(leadMarkerShown()).toBe(false);

        enemy.cloaked = false;
        rig.run();

        expect(leadMarkerShown()).toBe(true);
        expect(rig.solver.getPipTarget()).toBe(enemy.mesh);
        expect(missDistance(rig.shoot(), enemy.mesh.position)).toBeLessThan(0.02);
        expect(pixelDistance(rig.cross(), toPixel(enemy.mesh.position, rig.camera))).toBeLessThan(
          1.5
        );
      });

      it('leaves the assist and the lead marker to a visible jet farther from the nose', () => {
        const rig = createGunRig({ touch: true });
        const wraith = rig.addEnemy(rig.pointOffNose(0.8, 300, 180));
        wraith.cloaked = true;
        const fighter = rig.addEnemy(rig.pointOffNose(2.2, 300, 0));

        rig.run();
        const shot = rig.shoot();

        expect(missDistance(shot, fighter.mesh.position)).toBeLessThan(0.02);
        expect(missDistance(shot, wraith.mesh.position)).toBeGreaterThan(5);
        expect(rig.solver.getPipTarget()).toBe(fighter.mesh);
        expect(rig.solver.getAssistTarget()).toBe(fighter.mesh);
      });
    });

    describe('clearing the assist', () => {
      it.each(['resetGunAim', 'resetWeaponAim'])(
        '%s puts cross and bullets back on the nose at once',
        (method) => {
          const rig = createGunRig({ touch: true });
          rig.addEnemy(rig.pointOffNose(2, 300));
          rig.run();
          expect(pixelDistance(rig.cross(), rig.nosePixel())).toBeGreaterThan(10);

          callPrivate(rig.coordinator, method);
          rig.render(1);

          expect(pixelDistance(rig.cross(), rig.nosePixel())).toBeLessThan(1e-6);
          expect(reticleFlag()).toBe('false');
          expect(angleBetween(rig.shoot().direction, rig.nose)).toBeLessThan(1e-9);
          // 也不是从上一步的位置滑回来
          rig.render(0);
          expect(pixelDistance(rig.cross(), rig.nosePixel())).toBeLessThan(1e-6);
        }
      );

      it('picks the target up again afterwards, sliding in rather than jumping', () => {
        const rig = createGunRig({ touch: true });
        const enemy = rig.addEnemy(rig.pointOffNose(2, 300));
        rig.run();
        const full = pixelDistance(rig.cross(), rig.nosePixel());
        callPrivate(rig.coordinator, 'resetGunAim');

        const shifts: number[] = [];
        for (let i = 0; i < SETTLE_STEPS; i += 1) {
          rig.step();
          shifts.push(pixelDistance(rig.cross(), rig.nosePixel()));
        }

        expect(shifts[0]).toBeLessThan(1e-6);
        const first = shifts.find((shift) => shift > 1e-6);
        expect(first).toBeDefined();
        expect(first as number).toBeLessThan(full * 0.7);
        expect(shifts[shifts.length - 1]).toBeCloseTo(full, 1);
        expect(missDistance(rig.shoot(), enemy.mesh.position)).toBeLessThan(0.02);
      });
    });

    describe('when the aim display is off', () => {
      it.each([
        ['paused', (state: { paused: boolean }) => (state.paused = true)],
        ['not playing', (state: { playing: boolean }) => (state.playing = false)],
        ['held for a story beat', (state: { storyHold: boolean }) => (state.storyHold = true)],
      ])('shows no gun cross while %s', (_name, change) => {
        const rig = createGunRig({ touch: true });
        rig.addEnemy(rig.pointOffNose(2, 300));
        rig.run();
        expect(indicator.getGunCrossScreen().visible).toBe(true);

        change(rig.state);
        rig.render(1);

        expect(indicator.getGunCrossScreen().visible).toBe(false);
        expect(indicator.isGunCrossAssisted()).toBe(false);
      });

      it('shows no gun cross while the aircraft is hidden', () => {
        const rig = createGunRig({ touch: true });
        rig.addEnemy(rig.pointOffNose(2, 300));
        rig.run();

        rig.aircraft.visible = false;
        rig.render(1);

        expect(indicator.getGunCrossScreen().visible).toBe(false);
      });
    });
  });

  describe('special weapon flash in first person', () => {
    interface WeaponOptions {
      onFired: (id: SpecialWeaponId, position: THREE.Vector3, direction: THREE.Vector3) => void;
    }

    const WEAPONS: SpecialWeaponId[] = ['rockets', 'laser', 'swarm', 'railgun', 'emp'];

    function fireWeapon(id: SpecialWeaponId, firstPerson: boolean) {
      const createMuzzleFlash = vi.fn();
      const setScreenEffects = vi.fn();
      const addShake = vi.fn();
      const coordinator = coordinatorWith({
        gameScene: { scene: new THREE.Scene(), setScreenEffects },
        presentation: autoStub(),
        view: { isFirstPerson: () => firstPerson, addShake, addExplosionShake: vi.fn() },
        particleSystem: { createMuzzleFlash },
        audioManager: autoStub(),
        hud: autoStub(),
      });
      captured.weaponOptions.length = 0;
      callPrivate(coordinator, 'createSpecialWeaponsController');
      expect(captured.weaponOptions).toHaveLength(1);
      const options = captured.weaponOptions[0] as WeaponOptions;
      expect(typeof options.onFired).toBe('function');

      const position = new THREE.Vector3(10, 300, -20);
      const direction = new THREE.Vector3(0, 0, -1);
      options.onFired(id, position, direction);

      expect(createMuzzleFlash).toHaveBeenCalledTimes(1);
      const [flashPosition, flashDirection, flashScale] = createMuzzleFlash.mock.calls[0] as [
        THREE.Vector3,
        THREE.Vector3,
        number,
      ];
      const screenFlashes = setScreenEffects.mock.calls.map(
        ([effects]) => (effects as { flash?: number }).flash
      );
      return {
        flashPosition,
        flashDirection,
        flashScale,
        screenFlashes,
        shakes: addShake.mock.calls.map(([amount]) => amount as number),
        position,
        direction,
      };
    }

    it.each(WEAPONS)('leaves the %s muzzle flash as it was in third person', (id) => {
      const fired = fireWeapon(id, false);

      expect(fired.flashScale).toBeCloseTo(id === 'railgun' ? 1.6 : 1, 9);
      expect(fired.flashPosition).toBe(fired.position);
      expect(fired.flashDirection).toBe(fired.direction);
    });

    it.each(WEAPONS)('shrinks the %s muzzle flash to about 0.55 in first person', (id) => {
      const thirdPerson = fireWeapon(id, false);
      const firstPerson = fireWeapon(id, true);

      const ratio = firstPerson.flashScale / thirdPerson.flashScale;
      expect(ratio).toBeGreaterThan(0.45);
      expect(ratio).toBeLessThan(0.65);
      expect(firstPerson.flashPosition).toBe(firstPerson.position);
      expect(firstPerson.flashDirection).toBe(firstPerson.direction);
    });

    it('leaves the railgun screen flash as it was in third person', () => {
      const fired = fireWeapon('railgun', false);

      expect(fired.screenFlashes).toHaveLength(1);
      expect(fired.screenFlashes[0]).toBeCloseTo(0.25, 9);
    });

    it('dims the railgun screen flash to about 0.55 of that in first person', () => {
      const thirdPerson = fireWeapon('railgun', false);
      const firstPerson = fireWeapon('railgun', true);

      expect(firstPerson.screenFlashes).toHaveLength(1);
      const ratio =
        (firstPerson.screenFlashes[0] as number) / (thirdPerson.screenFlashes[0] as number);
      expect(ratio).toBeGreaterThan(0.45);
      expect(ratio).toBeLessThan(0.65);
    });

    it('scales the muzzle flash and the screen flash by the same amount', () => {
      const thirdPerson = fireWeapon('railgun', false);
      const firstPerson = fireWeapon('railgun', true);

      expect(firstPerson.flashScale / thirdPerson.flashScale).toBeCloseTo(
        (firstPerson.screenFlashes[0] as number) / (thirdPerson.screenFlashes[0] as number),
        9
      );
    });

    it.each(WEAPONS.filter((id) => id !== 'railgun'))(
      'gives the %s no screen flash in either view',
      (id) => {
        expect(fireWeapon(id, false).screenFlashes).toHaveLength(0);
        expect(fireWeapon(id, true).screenFlashes).toHaveLength(0);
      }
    );

    it.each(WEAPONS)('keeps the %s camera shake the same in both views', (id) => {
      const thirdPerson = fireWeapon(id, false);
      const firstPerson = fireWeapon(id, true);

      expect(thirdPerson.shakes).toHaveLength(1);
      expect(firstPerson.shakes).toEqual(thirdPerson.shakes);
    });
  });

  describe('pause menu save wiring', () => {
    interface PauseOptions {
      getSaveStatus?: () => { kind: string };
      onSaveAndExit?: () => { kind: string };
    }

    const NON_SAVING_KINDS = ['no-save-mode', 'not-started', 'complete'];

    async function openPauseMenu() {
      const state = { playing: true };
      const saved = { kind: 'saved', stage: 'wave', position: { en: 'Wave 2', zh: '第 2 波' } };
      const campaign = {
        describeExitSave: vi.fn(() => saved),
        saveForExit: vi.fn(() => saved),
      };
      const coordinator = coordinatorWith({
        pauseMenu: null,
        pauseMenuPromise: null,
        isDisposed: false,
        sessionState: { isPlaying: () => state.playing, isPaused: () => true },
        campaign,
        options: {},
        audioManager: autoStub(),
        musicSystem: autoStub(),
        voiceSystem: autoStub(),
      });
      const menu = await callPrivate<Promise<unknown>>(coordinator, 'ensurePauseMenu');
      expect(captured.pauseOptions).toHaveLength(1);
      return {
        coordinator,
        menu,
        state,
        campaign,
        saved,
        options: captured.pauseOptions[0] as PauseOptions,
      };
    }

    it('gives the pause menu both getSaveStatus and onSaveAndExit', async () => {
      const { options } = await openPauseMenu();

      expect(typeof options.getSaveStatus).toBe('function');
      expect(typeof options.onSaveAndExit).toBe('function');
    });

    it('previews the save through the campaign while the session is playing', async () => {
      const { options, campaign, saved } = await openPauseMenu();

      const status = options.getSaveStatus?.();

      expect(status).toBe(saved);
      expect(campaign.describeExitSave).toHaveBeenCalledTimes(1);
      // 只是预告：还没有写任何东西
      expect(campaign.saveForExit).not.toHaveBeenCalled();
    });

    it('saves through the campaign and hands back its real result while playing', async () => {
      const { options, campaign } = await openPauseMenu();
      const failed = { kind: 'failed' };
      campaign.saveForExit.mockReturnValueOnce(failed as never);

      const result = options.onSaveAndExit?.();

      expect(campaign.saveForExit).toHaveBeenCalledTimes(1);
      expect(result).toBe(failed);
    });

    it('reports a non-saving status when the session is not playing', async () => {
      const { options, campaign, state } = await openPauseMenu();
      state.playing = false;

      const status = options.getSaveStatus?.();

      expect(status).toBeDefined();
      expect(NON_SAVING_KINDS).toContain(status?.kind);
      expect(campaign.describeExitSave).not.toHaveBeenCalled();
    });

    it('does not save, and says so, when the session is not playing', async () => {
      const { options, campaign, state } = await openPauseMenu();
      state.playing = false;

      const result = options.onSaveAndExit?.();

      expect(result).toBeDefined();
      expect(NON_SAVING_KINDS).toContain(result?.kind);
      expect(campaign.saveForExit).not.toHaveBeenCalled();
    });

    it('checks the session at the moment it is asked, not when the menu was built', async () => {
      const { options, campaign, state, saved } = await openPauseMenu();

      state.playing = false;
      expect(options.getSaveStatus?.().kind).not.toBe('saved');
      expect(options.onSaveAndExit?.().kind).not.toBe('saved');
      state.playing = true;
      expect(options.getSaveStatus?.()).toBe(saved);
      expect(options.onSaveAndExit?.()).toBe(saved);

      expect(campaign.describeExitSave).toHaveBeenCalledTimes(1);
      expect(campaign.saveForExit).toHaveBeenCalledTimes(1);
    });

    it('hands out the same menu the next time it is asked for', async () => {
      const { coordinator, menu } = await openPauseMenu();

      const again = await callPrivate<Promise<unknown>>(coordinator, 'ensurePauseMenu');

      expect(again).toBe(menu);
      expect(captured.pauseOptions).toHaveLength(1);
    });
  });
});
