import * as THREE from 'three';
import { expect, vi } from 'vitest';
import { GameConfig } from '@/config';
import { GameSessionState } from '@/core/GameSessionState';
import { PresentationController, type RadarBlip } from '@/core/PresentationController';
import type { ICampaignPresentation } from '@/core/campaign/CampaignPresentation';
import { CombatHudFeed } from '@/core/hud/CombatHudFeed';
import { EnemySystem } from '@/core/systems/EnemySystem';
import { UnitController } from '@/core/units/UnitController';
import { createFriendlyMesh } from '@/features/aircraft/AircraftMeshFactory';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import type { EnemyAI } from '@/features/enemy/EnemyAI';
import type { EnemyType } from '@/features/enemy/EnemyTypes';
import { FriendlyAI, WINGMAN_CONFIG } from '@/features/enemy/FriendlyAI';
import type { UnitInstance, UnitSystem } from '@/features/units/UnitSystem';
import type { UnitType } from '@/features/units/UnitTypes';
import type { LocalizedText } from '@/i18n';
import type { BossMissileIndicator } from '@/ui/BossMissileIndicator';
import { EnemyHealthBars } from '@/ui/EnemyHealthBars';
import { HUD } from '@/ui/HUD';
import type { LockOnIndicator } from '@/ui/LockOnIndicator';
import {
  copyShapes,
  installCanvasRecording,
  type CanvasRecorder,
  type CanvasRecording,
  type PaintedShape,
} from './canvasRecorder';
import { resetLocale } from './i18nTestUtils';

/**
 * 战斗 HUD 台架：敌机 / 僚机 / 单位 → CombatHudFeed → 表现层（HUD、血条层、雷达）整条链路都是
 * 真实实现，只有锁定框与 Boss 导弹指示器是替身（不在这条链路上）。
 *
 * - 敌机走真实的生成路径（EnemySystem.spawnEnemyAt → LevelManager → 机体工厂 + 机型条令），
 *   僚机照协调器的做法组装（createFriendlyMesh(WINGMAN_CONFIG) + FriendlyAI + spawnFriendly）。
 *   台架不推进敌机 AI：摆在哪里就停在哪里（要推进的用例自己调 enemies.updateWithPlayer）。
 * - 隐形：隐形周期由别的用例负责，这里只看 HUD 一侧——用 cloak() 让某一架真实敌机的
 *   isCloaked() 报告“隐形中 / 没有隐形”。
 * - 喂给表现层的雷达目标与血条快照当场拷贝（它们来自复用池）；画出来的东西从 DOM 与
 *   记录型画布上读。
 */

export const VIEW_WIDTH = 1280;
export const VIEW_HEIGHT = 720;
/** 相机的垂直视场（度） */
export const CAMERA_FOV_DEG = 75;
/** 一次雷达刷新（20 Hz 略放宽，保证每次都重画） */
const RADAR_REFRESH_SECONDS = 0.06;

export interface FedBlip {
  position: THREE.Vector3;
  kind: RadarBlip['kind'];
}

export interface FedBar {
  mesh: THREE.Object3D;
  currentHealth: number;
  maxHealth: number;
  objective: boolean;
}

export interface RadarDrawing {
  /** 雷达盘上画的形状 */
  dial: PaintedShape[];
  /** 展开的关卡地图上画的形状（没展开时为空） */
  map: PaintedShape[];
}

export interface CombatHudRig {
  readonly scene: THREE.Scene;
  readonly enemies: EnemySystem;
  readonly units: UnitController;
  readonly unitSystem: UnitSystem;
  readonly hud: HUD;
  readonly presentation: PresentationController;
  readonly feed: CombatHudFeed;
  readonly session: GameSessionState;
  readonly camera: THREE.PerspectiveCamera;
  /** 玩家位置（与相机同处） */
  readonly player: THREE.Vector3;
  /** 最近一次雷达刷新 / 血条刷新喂给表现层的东西 */
  readonly fed: { blips: FedBlip[]; enemies: FedBar[]; friendlies: FedBar[] };
  /** 雷达已经刷新了几次 */
  radarRefreshes(): number;

  spawnJet(type: EnemyType, position: THREE.Vector3): EnemyAI;
  spawnWingman(position: THREE.Vector3, callsign?: LocalizedText): FriendlyAI;
  spawnUnit(type: UnitType, position: THREE.Vector3): UnitInstance;
  /** 让这架敌机报告“隐形中”（true）或“没有隐形”（false） */
  cloak(jet: EnemyAI, hidden: boolean): void;

  /** 玩家（与相机）站在 from，朝 target 看 */
  lookFrom(from: THREE.Vector3, target: THREE.Vector3): void;
  /** 玩家沿视线方向飞出这么多米（游戏里玩家每一帧都在往前飞） */
  fly(metres?: number): void;
  refreshRadar(): void;
  refreshBars(): void;
  /** 游戏里的一帧 HUD：玩家往前飞了一点，雷达与血条各刷新一次 */
  hudFrame(metres?: number): void;
  /** 展开关卡地图（按 N） */
  openMap(): void;
  /** 刷新一次雷达，返回这一次画在雷达盘 / 关卡地图上的全部形状 */
  drawRadar(): RadarDrawing;

  /** 世界坐标在画面上的像素位置 */
  screenPoint(world: THREE.Vector3): { x: number; y: number };
  shownBars(): HTMLElement[];
  shownChevrons(): HTMLElement[];
  shownBrackets(): HTMLElement[];
  /** 这个目标头顶正在显示的血条（按画面位置认）；没有时为 null */
  barOf(mesh: THREE.Object3D): HTMLElement | null;
  /** 指向这个目标、正在显示的屏幕外箭头（按距离标签认）；没有时为 null */
  chevronOf(mesh: THREE.Object3D): HTMLElement | null;
  /** 喂给雷达的目标里，位于这个位置的那一个的种类；没有时为 undefined */
  blipAt(position: THREE.Vector3): RadarBlip['kind'] | undefined;
  /** 喂给血条层的敌方 / 友军快照里，这个网格的那一条 */
  fedBar(mesh: THREE.Object3D): FedBar | undefined;

  dispose(): void;
}

/** 任意方法都是 vi.fn() 的替身 */
function autoStub<T>(): T {
  const methods = new Map<PropertyKey, unknown>();
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

export function isShown(element: Element): boolean {
  if (!element.isConnected) return false;
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

export function pixels(value: string, what: string): number {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?(?:e-?\d+)?)px$/);
  expect(match, `${what}: "${value}" is a pixel length`).toBeTruthy();
  return Number((match as RegExpMatchArray)[1]);
}

/** 血条在画面上的位置：水平中心、上沿、宽、高，以及血量填充占整条的比例 */
export function readBar(bar: HTMLElement): {
  centreX: number;
  top: number;
  width: number;
  height: number;
  fill: number;
  name: string;
} {
  const width = pixels(bar.style.width, 'bar width');
  const height = pixels(bar.style.height, 'bar height');
  const left = pixels(bar.style.left, 'bar left');
  const top = pixels(bar.style.top, 'bar top');
  const background = bar.querySelector<HTMLElement>('.health-bar-background');
  expect(background, 'the bar has a fill').toBeTruthy();
  const fill = pixels((background as HTMLElement).style.width, 'fill width') / width;
  const label = bar.querySelector<HTMLElement>('.enemy-name');
  const name = label && isShown(label) ? (label.textContent ?? '') : '';
  return { centreX: left + width / 2, top, width, height, fill, name };
}

export async function createCombatHudRig(): Promise<CombatHudRig> {
  const original = {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    isMobile: GameConfig.isMobile,
    maxTouchPoints: navigator.maxTouchPoints,
  };
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: VIEW_WIDTH });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: VIEW_HEIGHT });
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
  GameConfig.isMobile = false;
  window.ontouchstart = null;
  document.body.innerHTML = '';

  let now = 50_000;
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
  // 先装记录型画布：雷达在创建时取 2D 上下文（敌机模型画贴图时也会取）
  const recording: CanvasRecording = installCanvasRecording();

  const scene = new THREE.Scene();
  const enemies = new EnemySystem(scene);
  enemies.init();

  const units = new UnitController({
    scene,
    presentation: autoStub<ICampaignPresentation>(),
    awardKill: vi.fn(),
    applyPenalty: vi.fn(),
    onAssetLost: vi.fn(),
    damagePlayer: vi.fn(),
    onExplosion: vi.fn(),
    onEscortResult: vi.fn(),
  });
  const unitSystem = await units.ensureLoaded(autoStub<ParticleSystem>());

  const hud = new HUD();
  const presentation = new PresentationController({
    hud,
    enemyHealthBars: new EnemyHealthBars(),
    bossIndicator: autoStub<BossMissileIndicator>(),
    lockOnIndicator: autoStub<LockOnIndicator>(),
  });
  presentation.initializeCombatUi();

  const fed: CombatHudRig['fed'] = { blips: [], enemies: [], friendlies: [] };
  let radarRefreshes = 0;
  const copyBar = (bar: {
    mesh: THREE.Object3D;
    currentHealth: number;
    maxHealth: number;
    objective?: boolean;
  }): FedBar => ({
    mesh: bar.mesh,
    currentHealth: bar.currentHealth,
    maxHealth: bar.maxHealth,
    objective: bar.objective === true,
  });
  // 记下喂给表现层的东西，再原样交给真正的表现层
  const realUpdateRadar = presentation.updateRadar.bind(presentation);
  vi.spyOn(presentation, 'updateRadar').mockImplementation((position, blips, rotation) => {
    radarRefreshes++;
    fed.blips = blips.map((blip) => ({ position: blip.position.clone(), kind: blip.kind }));
    realUpdateRadar(position, blips, rotation);
  });
  const realUpdateBars = presentation.updateEnemyHealthBars.bind(presentation);
  vi.spyOn(presentation, 'updateEnemyHealthBars').mockImplementation(
    (enemyBars, friendlyBars, viewCamera, position) => {
      fed.enemies = enemyBars.map(copyBar);
      fed.friendlies = friendlyBars.map(copyBar);
      realUpdateBars(enemyBars, friendlyBars, viewCamera, position);
    }
  );

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, VIEW_WIDTH / VIEW_HEIGHT, 0.1, 50000);
  const player = new THREE.Vector3();
  const session = new GameSessionState();
  const feed = new CombatHudFeed({
    session,
    units,
    camera,
    getEnemySystem: () => enemies,
    getBossController: () => null,
    getPresentationController: () => presentation,
    getPlayerPosition: () => player,
    getPlayerQuaternion: () => camera.quaternion,
  });

  const cloaks = new Map<
    EnemyAI,
    { mockReturnValue(value: boolean): unknown; mockRestore(): void }
  >();
  const friendlies: FriendlyAI[] = [];

  const dialCanvas = (): HTMLCanvasElement | null =>
    document.querySelector<HTMLCanvasElement>('#radar-minimap canvas');
  const mapNode = (): HTMLElement | null => document.getElementById('radar-map');
  const mapShown = (): boolean => {
    const node = mapNode();
    return node !== null && node.isConnected && node.style.display !== 'none';
  };
  const recorderOf = (canvas: HTMLCanvasElement | null, what: string): CanvasRecorder => {
    expect(canvas, `${what} draws on a canvas`).toBeTruthy();
    const recorder = recording.of(canvas);
    expect(recorder, `${what} asked for a 2D context`).toBeTruthy();
    return recorder as CanvasRecorder;
  };
  const all = (selector: string): HTMLElement[] =>
    Array.from(document.querySelectorAll<HTMLElement>(selector));

  const rig: CombatHudRig = {
    scene,
    enemies,
    units,
    unitSystem,
    hud,
    presentation,
    feed,
    session,
    camera,
    player,
    fed,
    radarRefreshes: () => radarRefreshes,

    spawnJet(type, position) {
      const before = new Set(enemies.getEnemies());
      enemies.spawnEnemyAt(type, position);
      const spawned = enemies.getEnemies().filter((enemy) => !before.has(enemy));
      expect(spawned, `spawnEnemyAt(${type}) adds one jet`).toHaveLength(1);
      expect(
        spawned[0].getMesh().position.distanceTo(position),
        `${type} is where it was put`
      ).toBe(0);
      return spawned[0];
    },

    spawnWingman(position, callsign) {
      const mesh = createFriendlyMesh(WINGMAN_CONFIG);
      mesh.position.copy(position);
      if (callsign) mesh.userData.displayName = callsign;
      const friendly = new FriendlyAI(mesh, WINGMAN_CONFIG, scene);
      scene.add(mesh);
      enemies.spawnFriendly(friendly);
      friendlies.push(friendly);
      return friendly;
    },

    spawnUnit(type, position) {
      const unit = unitSystem.spawnUnit(type, position);
      expect(unit, `spawnUnit(${type})`).not.toBeNull();
      return unit as UnitInstance;
    },

    cloak(jet, hidden) {
      let spy = cloaks.get(jet);
      if (!spy) {
        spy = vi.spyOn(jet, 'isCloaked');
        cloaks.set(jet, spy);
      }
      spy.mockReturnValue(hidden);
    },

    lookFrom(from, target) {
      camera.position.copy(from);
      camera.lookAt(target);
      camera.updateMatrixWorld(true);
      player.copy(from);
    },

    fly(metres = 2) {
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      camera.position.addScaledVector(forward, metres);
      camera.updateMatrixWorld(true);
      player.copy(camera.position);
    },

    refreshRadar() {
      now += RADAR_REFRESH_SECONDS * 1000;
      const before = radarRefreshes;
      feed.updateRadar(RADAR_REFRESH_SECONDS);
      expect(radarRefreshes, 'the radar refreshed').toBe(before + 1);
    },

    refreshBars() {
      feed.updateHealthBars();
    },

    hudFrame(metres = 2) {
      rig.fly(metres);
      rig.refreshRadar();
      rig.refreshBars();
    },

    openMap() {
      rig.refreshRadar();
      if (!mapShown()) {
        document.body.dispatchEvent(
          new KeyboardEvent('keydown', { code: 'KeyN', key: 'n', bubbles: true, cancelable: true })
        );
      }
      expect(mapShown(), 'the level map opens').toBe(true);
      rig.refreshRadar();
    },

    drawRadar() {
      const dial = recorderOf(dialCanvas(), 'the radar dial');
      const map = mapShown()
        ? recorderOf(mapNode()?.querySelector('canvas') ?? null, 'the level map')
        : null;
      dial.clear();
      map?.clear();
      rig.refreshRadar();
      expect(dial.ops.length, 'the dial is redrawn on a radar refresh').toBeGreaterThan(0);
      if (map) expect(map.ops.length, 'the map is redrawn on a radar refresh').toBeGreaterThan(0);
      return { dial: copyShapes(dial.shapes), map: map ? copyShapes(map.shapes) : [] };
    },

    screenPoint(world) {
      const ndc = world.clone().project(camera);
      return { x: ((ndc.x + 1) / 2) * VIEW_WIDTH, y: ((1 - ndc.y) / 2) * VIEW_HEIGHT };
    },

    shownBars: () => all('.enemy-health-bar').filter(isShown),
    shownChevrons: () => all('.enemy-arrow-indicator').filter(isShown),
    shownBrackets: () => all('.enemy-target-bracket').filter(isShown),

    barOf(mesh) {
      const at = rig.screenPoint(mesh.getWorldPosition(new THREE.Vector3()));
      // 血条在目标的正上方：水平中心对着目标，离目标不到 150 px
      const candidates = rig.shownBars().filter((bar) => {
        const drawn = readBar(bar);
        return Math.abs(drawn.centreX - at.x) < 2 && drawn.top < at.y && at.y - drawn.top < 150;
      });
      expect(candidates.length, 'at most one bar over a target').toBeLessThanOrEqual(1);
      return candidates[0] ?? null;
    },

    chevronOf(mesh) {
      const distance = player.distanceTo(mesh.getWorldPosition(new THREE.Vector3()));
      const candidates = rig.shownChevrons().filter((chevron) => {
        const text = chevron.querySelector('.offscreen-chevron-distance')?.textContent ?? '';
        const match = text.match(/^(\d+)m$/);
        return match !== null && Math.abs(Number(match[1]) - distance) <= 1;
      });
      expect(candidates.length, 'at most one chevron per target').toBeLessThanOrEqual(1);
      return candidates[0] ?? null;
    },

    blipAt(position) {
      return fed.blips.find((blip) => blip.position.distanceTo(position) < 0.01)?.kind;
    },

    fedBar(mesh) {
      return (
        fed.enemies.find((bar) => bar.mesh === mesh) ??
        fed.friendlies.find((bar) => bar.mesh === mesh)
      );
    },

    dispose() {
      presentation.dispose();
      units.dispose();
      for (const friendly of friendlies) friendly.dispose();
      enemies.getLevelManager().dispose(scene);
      enemies.dispose();
      // 只还原自己装的：vi.restoreAllMocks 会连全局 setup 里的替身（尾迹渲染器）一起清掉
      for (const spy of cloaks.values()) spy.mockRestore();
      cloaks.clear();
      recording.restore();
      clock.mockRestore();
      resetLocale();
      GameConfig.isMobile = original.isMobile;
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: original.innerWidth,
      });
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: original.innerHeight,
      });
      Object.defineProperty(navigator, 'maxTouchPoints', {
        configurable: true,
        value: original.maxTouchPoints,
      });
      document.body.innerHTML = '';
    },
  };
  return rig;
}
