import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameSessionState } from '@/core/GameSessionState';
import type { PresentationController } from '@/core/PresentationController';
import type { ICampaignPresentation } from '@/core/campaign/CampaignPresentation';
import { Faction } from '@/core/Faction';
import { CombatHudFeed } from '@/core/hud/CombatHudFeed';
import type { EnemySystem } from '@/core/systems/EnemySystem';
import { UnitController } from '@/core/units/UnitController';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import type { UnitInstance, UnitSystem } from '@/features/units/UnitSystem';
import { UNIT_CONFIGS, UNIT_TYPES, UnitType } from '@/features/units/UnitTypes';
import { setLocale, type LocalizedText } from '@/i18n';
import { EnemyHealthBars } from '@/ui/EnemyHealthBars';
import { LOCALES, expectBilingual, resetLocale, textIn } from './i18nTestUtils';

/**
 * 敌方单位的目标标记（规格 M1 / M2 / M3 的标记部分），整条链路用真实实现：
 * UnitSystem → UnitController.forEachHostileMarker / isObjectiveActive → CombatHudFeed.updateHealthBars
 * → EnemyHealthBars（DOM）。
 *
 * - M1：每个存活、可被命中的敌方单位每帧都喂给血条层：血条、具体的名称（网格 userData.displayName，
 *   双语）、出视野时带距离的屏幕外箭头；切换语言名称跟着换；平民 / 友军单位不算敌方；
 *   打不到的单位（潜航的潜艇）没有标记。
 * - M2：目标在屏幕上太小（约 22 px 以下）时画一个方形目标框，下面是四舍五入到 10 米的距离；
 *   变大到约 28 px 以上才收起（滞回）。
 * - M3：敌机清空、单位拖住波次时，剩下的单位总是有目标框，目标框与箭头带 is-objective。
 *
 * 屏幕外箭头的像素位置（避开摇杆 / 按键 / 雷达、留在屏幕内）在 ChevronAvoidance.test.ts 里断言。
 */

const VIEW_WIDTH = 1280;
const VIEW_HEIGHT = 720;
const OBJECTIVE_CLASS = 'is-objective';
const CJK = /[一-鿿]/;

const HOSTILE_TYPES = UNIT_TYPES.filter((type) => UNIT_CONFIGS[type].faction === Faction.ENEMY);
const NON_HOSTILE_TYPES = UNIT_TYPES.filter((type) => UNIT_CONFIGS[type].faction !== Faction.ENEMY);
/** 潜艇一开局就潜航，单独测 */
const SURFACE_HOSTILE_TYPES = HOSTILE_TYPES.filter((type) => type !== UnitType.SUBMARINE);

interface FedBar {
  mesh: THREE.Object3D;
  currentHealth: number;
  maxHealth: number;
  objective: boolean;
}

/** 敌机的最小替身（血条馈送只读这几样） */
interface JetStub {
  mesh: THREE.Object3D;
  alive: boolean;
}

function particleStub(): ParticleSystem {
  const noop = (): void => undefined;
  return new Proxy(
    {},
    { get: (_target, property) => (property === 'then' ? undefined : noop) }
  ) as unknown as ParticleSystem;
}

function isShown(element: Element): boolean {
  if (!element.isConnected) return false;
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function px(value: string): number {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)px$/);
  expect(match, `"${value}" is a pixel length`).toBeTruthy();
  return Number((match as RegExpMatchArray)[1]);
}

/** 标记上的距离文字（"1230m"；也接受 "1.2km"）换成米 */
function metres(text: string | null | undefined): number {
  const match = (text ?? '').trim().match(/^(\d+(?:\.\d+)?)\s*(km|m)$/i);
  expect(match, `"${text}" is a distance`).toBeTruthy();
  const [, value, unit] = match as RegExpMatchArray;
  return Number(value) * (unit.toLowerCase() === 'km' ? 1000 : 1);
}

describe('hostile unit target markers', () => {
  let controller: UnitController;
  let system: UnitSystem;
  let bars: EnemyHealthBars;
  let feed: CombatHudFeed;
  let camera: THREE.PerspectiveCamera;
  let fedEnemies: FedBar[];
  let fedFriendlies: FedBar[];
  let jets: JetStub[];
  let originalInnerWidth: number;
  let originalInnerHeight: number;
  const playerPosition = new THREE.Vector3();
  const playerMesh = new THREE.Object3D();

  beforeEach(async () => {
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: VIEW_WIDTH });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: VIEW_HEIGHT });
    document.body.innerHTML = '';

    const unitPresentation = {
      genericRadio: vi.fn(() => true),
      unitFirstContact: vi.fn(),
      onUnitEvent: vi.fn(),
      flashWarning: vi.fn(),
      setMissileWarning: vi.fn(),
      setRadarRangeMultiplier: vi.fn(),
    };
    controller = new UnitController({
      scene: new THREE.Scene(),
      presentation: unitPresentation as unknown as ICampaignPresentation,
      awardKill: vi.fn(),
      applyPenalty: vi.fn(),
      onAssetLost: vi.fn(),
      damagePlayer: vi.fn(),
      onExplosion: vi.fn(),
      onEscortResult: vi.fn(),
    });
    system = await controller.ensureLoaded(particleStub());

    camera = new THREE.PerspectiveCamera(75, VIEW_WIDTH / VIEW_HEIGHT, 0.1, 50000);
    bars = new EnemyHealthBars();
    fedEnemies = [];
    fedFriendlies = [];
    jets = [];

    const copy = (bar: Partial<FedBar> & Pick<FedBar, 'mesh'>): FedBar => ({
      mesh: bar.mesh,
      currentHealth: bar.currentHealth ?? Number.NaN,
      maxHealth: bar.maxHealth ?? Number.NaN,
      objective: bar.objective === true,
    });
    // 表现层替身：记下喂进来的快照（快照对象来自复用池，要当场拷贝），再交给真正的血条层
    const presentation = {
      updateEnemyHealthBars(
        enemies: FedBar[],
        friendlies: FedBar[],
        viewCamera: THREE.Camera,
        position: THREE.Vector3
      ): void {
        fedEnemies = enemies.map(copy);
        fedFriendlies = friendlies.map(copy);
        bars.update(enemies, friendlies, viewCamera, position);
      },
    };
    const enemySystem = {
      getEnemies: () =>
        jets.map((jet) => ({
          isAlive: () => jet.alive,
          getMesh: () => jet.mesh,
          getHealth: () => ({ current: 40, max: 50 }),
          getConfig: () => ({ health: 50 }),
        })),
      getFriendlyAIs: () => [],
      getLevelManager: () => null,
    };
    const session = { isBossMode: () => false, isInBossBattle: () => false };

    feed = new CombatHudFeed({
      session: session as unknown as GameSessionState,
      units: controller,
      camera,
      getEnemySystem: () => enemySystem as unknown as EnemySystem,
      getBossController: () => null,
      getPresentationController: () => presentation as unknown as PresentationController,
      getPlayerPosition: () => playerPosition,
      getPlayerQuaternion: () => camera.quaternion,
    });
  });

  afterEach(() => {
    bars.dispose();
    controller.dispose();
    resetLocale();
    document.body.innerHTML = '';
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    });
  });

  // ───────────────────────────── 场景摆放 ─────────────────────────────

  let slot = 0;
  beforeEach(() => {
    slot = 0;
  });

  /** 单位彼此隔开 4 公里，互不进对方的画面 */
  function spawn(type: UnitType): UnitInstance {
    const air = UNIT_CONFIGS[type].domain === 'air';
    const unit = system.spawnUnit(type, new THREE.Vector3(slot * 4000, air ? 500 : 0, 0));
    slot++;
    expect(unit, `spawnUnit(${type})`).not.toBeNull();
    return unit as UnitInstance;
  }

  function positionOf(unit: UnitInstance): THREE.Vector3 {
    return unit.mesh.getWorldPosition(new THREE.Vector3());
  }

  interface ViewOptions {
    /** 相机向左转这么多度：目标落在画面右侧 */
    turnLeftDeg?: number;
    /** 背对目标 */
    away?: boolean;
  }

  /** 玩家（与相机）在离目标 distance 米处，默认正对目标 */
  function view(unit: UnitInstance, distance: number, options: ViewOptions = {}): void {
    const target = positionOf(unit);
    const back = new THREE.Vector3(0, 0.12, 1).normalize();
    camera.position.copy(target).addScaledVector(back, distance);
    camera.lookAt(target);
    if (options.away) camera.rotateY(Math.PI);
    else if (options.turnLeftDeg) camera.rotateY(THREE.MathUtils.degToRad(options.turnLeftDeg));
    camera.updateMatrixWorld(true);
    playerPosition.copy(camera.position);
    playerMesh.position.copy(camera.position);
  }

  function refresh(): void {
    feed.updateHealthBars();
  }

  /** 单位系统走一步；jetsCleared = 本波敌机已清空（协调器每帧传入） */
  function step(jetsCleared: boolean, seconds = 0.1): void {
    controller.update(seconds, playerMesh, playerPosition, [], [], jetsCleared);
  }

  /** 目标在画面上的像素位置 */
  function screenPoint(unit: UnitInstance): { x: number; y: number } {
    const ndc = positionOf(unit).project(camera);
    return { x: ((ndc.x + 1) / 2) * VIEW_WIDTH, y: ((1 - ndc.y) / 2) * VIEW_HEIGHT };
  }

  // ───────────────────────────── DOM 读取 ─────────────────────────────

  const all = (selector: string): HTMLElement[] =>
    Array.from(document.querySelectorAll<HTMLElement>(selector));
  const shownBars = (): HTMLElement[] => all('.enemy-health-bar').filter(isShown);
  const shownChevrons = (): HTMLElement[] => all('.enemy-arrow-indicator').filter(isShown);
  const shownBrackets = (): HTMLElement[] => all('.enemy-target-bracket').filter(isShown);
  const shownNames = (): string[] =>
    shownBars().map((bar) => bar.querySelector('.enemy-name')?.textContent ?? '');

  function onlyBracket(): HTMLElement {
    const brackets = shownBrackets();
    expect(brackets, 'one target bracket').toHaveLength(1);
    return brackets[0];
  }

  function onlyChevron(): HTMLElement {
    const chevrons = shownChevrons();
    expect(chevrons, 'one off-screen chevron').toHaveLength(1);
    return chevrons[0];
  }

  function fedMeshes(): THREE.Object3D[] {
    return fedEnemies.map((bar) => bar.mesh);
  }

  // ───────────────────────────── M1：喂给血条层 ─────────────────────────────

  describe('which units are fed as hostile', () => {
    it('feeds every living, targetable hostile unit with its health', () => {
      const units = SURFACE_HOSTILE_TYPES.map((type) => spawn(type));
      view(units[0], 300);
      refresh();

      expect(new Set(fedMeshes())).toEqual(new Set(units.map((unit) => unit.mesh)));
      expect(fedEnemies).toHaveLength(units.length);
      for (const unit of units) {
        const fed = fedEnemies.find((bar) => bar.mesh === unit.mesh);
        const health = unit.getHealth();
        expect(fed?.currentHealth, unit.type).toBe(health.current);
        expect(fed?.maxHealth, unit.type).toBe(health.max);
      }
      expect(fedFriendlies).toEqual([]);
    });

    it('feeds them again every frame, with the current health', () => {
      const tank = spawn(UnitType.TANK);
      view(tank, 300);
      refresh();
      expect(fedMeshes()).toEqual([tank.mesh]);

      const max = tank.getHealth().max;
      tank.applyDamage(max / 2, 'cannon');
      refresh();
      expect(fedEnemies).toHaveLength(1);
      expect(fedEnemies[0].currentHealth).toBeCloseTo(max / 2, 5);
      expect(fedEnemies[0].maxHealth).toBe(max);
    });

    it('never feeds civilian or allied units as hostile', () => {
      const bystanders = NON_HOSTILE_TYPES.map((type) => spawn(type));
      expect(bystanders.length).toBeGreaterThan(0);
      view(bystanders[0], 300);
      refresh();
      expect(fedEnemies).toEqual([]);
      expect(all('.enemy-health-bar')).toHaveLength(0);
      expect(all('.enemy-arrow-indicator')).toHaveLength(0);
      expect(all('.enemy-target-bracket')).toHaveLength(0);

      const tank = spawn(UnitType.TANK);
      view(tank, 300);
      refresh();
      expect(fedMeshes()).toEqual([tank.mesh]);
    });

    it('stops feeding a unit once it is destroyed, and removes its markers', () => {
      const tank = spawn(UnitType.TANK);
      const frigate = spawn(UnitType.FRIGATE);
      view(tank, 300);
      refresh();
      expect(shownBars()).toHaveLength(1);
      expect(shownChevrons(), 'the frigate is out of view').toHaveLength(1);

      tank.applyDamage(1e6, 'missile');
      refresh();
      expect(fedMeshes()).toEqual([frigate.mesh]);
      expect(shownBars()).toHaveLength(0);
      expect(all('.enemy-health-bar')).toHaveLength(1);
      expect(shownChevrons()).toHaveLength(1);

      frigate.applyDamage(1e6, 'missile');
      refresh();
      expect(fedEnemies).toEqual([]);
      expect(all('.enemy-health-bar')).toHaveLength(0);
      expect(shownChevrons()).toHaveLength(0);
      expect(shownBrackets()).toHaveLength(0);
    });

    it('keeps marking enemy jets as before, next to the units', () => {
      const tank = spawn(UnitType.TANK);
      const jet = new THREE.Object3D();
      jet.name = 'jet-under-test';
      jet.position.copy(positionOf(tank)).add(new THREE.Vector3(0, 40, 0));
      jets.push({ mesh: jet, alive: true });
      const deadJet = new THREE.Object3D();
      jets.push({ mesh: deadJet, alive: false });

      view(tank, 300);
      refresh();
      expect(new Set(fedMeshes())).toEqual(new Set([jet, tank.mesh]));
      expect(fedEnemies.find((bar) => bar.mesh === jet)).toMatchObject({
        currentHealth: 40,
        maxHealth: 50,
        objective: false,
      });
      expect(shownBars(), 'jet and tank both have a health bar').toHaveLength(2);

      view(tank, 300, { away: true });
      refresh();
      expect(shownBars()).toHaveLength(0);
      expect(shownChevrons(), 'jet and tank both have an off-screen chevron').toHaveLength(2);
    });

    describe('submarine', () => {
      /** 潜艇在玩家 1000 米外不会上浮；靠近后等它浮出水面 */
      function surface(submarine: UnitInstance): void {
        for (let elapsed = 0; elapsed < 40 && !submarine.isTargetable(); elapsed += 0.1) {
          view(submarine, 500);
          step(false);
        }
        expect(submarine.isTargetable(), 'the submarine surfaced near the player').toBe(true);
      }

      it('gives a submerged submarine no marker at all', () => {
        const submarine = spawn(UnitType.SUBMARINE);
        view(submarine, 3000);
        for (let i = 0; i < 20; i++) step(false);
        expect(submarine.isAlive()).toBe(true);
        expect(submarine.isTargetable(), 'submerged').toBe(false);

        for (const away of [false, true]) {
          view(submarine, 3000, { away });
          refresh();
          expect(fedEnemies, away ? 'behind' : 'ahead').toEqual([]);
          expect(shownBars()).toHaveLength(0);
          expect(shownChevrons()).toHaveLength(0);
          expect(shownBrackets()).toHaveLength(0);
        }
        // 它仍然拖住波次
        expect(controller.getWaveHoldCount()).toBe(1);
      });

      it('marks the submarine once it has surfaced and unmarks it when it dives again', () => {
        const submarine = spawn(UnitType.SUBMARINE);
        view(submarine, 3000);
        for (let i = 0; i < 20; i++) step(false);
        refresh();
        expect(fedEnemies).toEqual([]);

        surface(submarine);
        view(submarine, 500);
        refresh();
        expect(fedMeshes()).toEqual([submarine.mesh]);
        expect(shownBars()).toHaveLength(1);
        expect(shownNames()).toEqual([UNIT_CONFIGS[UnitType.SUBMARINE].name.en]);

        // 远离后等它再次下潜
        for (let elapsed = 0; elapsed < 60 && submarine.isTargetable(); elapsed += 0.1) {
          view(submarine, 3000);
          step(false);
        }
        expect(submarine.isTargetable(), 'dived again').toBe(false);
        view(submarine, 3000);
        refresh();
        expect(fedEnemies).toEqual([]);
        expect(shownBars()).toHaveLength(0);
        expect(shownChevrons()).toHaveLength(0);
        expect(shownBrackets()).toHaveLength(0);
      });
    });
  });

  // ───────────────────────────── M1：血条与名称 ─────────────────────────────

  describe('health bar and name label', () => {
    it('gives every hostile unit mesh a specific bilingual display name', () => {
      const names = new Set<string>();
      for (const type of HOSTILE_TYPES) {
        const unit = spawn(type);
        const displayName = unit.mesh.userData.displayName as LocalizedText;
        expectBilingual(displayName, `${type} userData.displayName`);
        expect(displayName.zh, type).toMatch(CJK);
        expect(displayName.en, `${type} has its own name`).not.toMatch(
          /^(hostile|enemy)( unit)?$/i
        );
        names.add(displayName.en);
      }
      expect(names.size, 'no two unit types share a name').toBe(HOSTILE_TYPES.length);
    });

    it('labels the tank "Main Battle Tank"', () => {
      const tank = spawn(UnitType.TANK);
      view(tank, 300);
      refresh();
      expect(shownBars()).toHaveLength(1);
      expect(shownNames()).toEqual(['Main Battle Tank']);
    });

    it.each(SURFACE_HOSTILE_TYPES)(
      'shows a health bar and the name of the %s when it is in view',
      (type) => {
        const unit = spawn(type);
        const displayName = unit.mesh.userData.displayName as LocalizedText;
        view(unit, 300);
        refresh();
        expect(shownBars(), 'health bar').toHaveLength(1);
        expect(shownNames()).toEqual([displayName.en]);
        expect(shownChevrons(), 'no chevron while in view').toHaveLength(0);
      }
    );

    it.each(LOCALES)('shows the name in the interface language (%s)', (locale) => {
      setLocale(locale);
      const units = [spawn(UnitType.TANK), spawn(UnitType.FRIGATE), spawn(UnitType.BOMBER)];
      for (const unit of units) {
        view(unit, 300);
        refresh();
        expect(shownNames(), unit.type).toEqual([textIn(UNIT_CONFIGS[unit.type].name, locale)]);
      }
    });

    it('switches the label when the language changes', () => {
      const tank = spawn(UnitType.TANK);
      view(tank, 300);
      refresh();
      expect(shownNames()).toEqual(['Main Battle Tank']);

      // 暂停菜单里切换语言：游戏不再刷新血条，名字也要立刻换
      setLocale('zh-CN');
      const chinese = shownNames();
      expect(chinese).toHaveLength(1);
      expect(chinese[0]).toMatch(CJK);
      expect(chinese[0]).toBe((tank.mesh.userData.displayName as LocalizedText).zh);
      refresh();
      expect(shownNames()).toEqual(chinese);

      setLocale('en');
      expect(shownNames()).toEqual(['Main Battle Tank']);
      refresh();
      expect(shownNames()).toEqual(['Main Battle Tank']);
    });

    it('uses the new language for a unit that comes into view after the switch', () => {
      const tank = spawn(UnitType.TANK);
      view(tank, 300, { away: true });
      refresh();
      expect(shownBars()).toHaveLength(0);
      setLocale('zh-CN');
      view(tank, 300);
      refresh();
      expect(shownNames()).toEqual([(tank.mesh.userData.displayName as LocalizedText).zh]);
    });

    it('shrinks the bar as the unit takes damage', () => {
      const tank = spawn(UnitType.TANK);
      view(tank, 300);
      refresh();
      const fill = shownBars()[0].querySelector<HTMLElement>('.health-bar-background');
      expect(fill).toBeTruthy();
      const full = px((fill as HTMLElement).style.width);
      tank.applyDamage(tank.getHealth().max / 2, 'cannon');
      refresh();
      expect(px((fill as HTMLElement).style.width)).toBeCloseTo(full / 2, 0);
    });
  });

  // ───────────────────────────── M1：屏幕外箭头 ─────────────────────────────

  describe('off-screen chevron', () => {
    it.each([180, 742, 2315])(
      'points at a hostile unit outside the view and shows its distance (%d m)',
      (distance) => {
        const tank = spawn(UnitType.TANK);
        view(tank, distance, { away: true });
        refresh();
        expect(shownBars(), 'no health bar off screen').toHaveLength(0);
        const chevron = onlyChevron();
        const label = chevron.querySelector('.offscreen-chevron-distance');
        expect(label, 'the chevron carries a distance label').toBeTruthy();
        expect(Math.abs(metres(label?.textContent) - distance)).toBeLessThanOrEqual(
          Math.max(1.5, distance * 0.05)
        );
      }
    );

    it.each(SURFACE_HOSTILE_TYPES)('is shown for an off-screen %s', (type) => {
      const unit = spawn(type);
      view(unit, 600, { away: true });
      refresh();
      onlyChevron();
      expect(shownBars()).toHaveLength(0);
    });

    it('swaps with the health bar as the unit leaves and enters the view', () => {
      const tank = spawn(UnitType.TANK);
      view(tank, 400);
      refresh();
      expect(shownBars()).toHaveLength(1);
      expect(shownChevrons()).toHaveLength(0);

      view(tank, 400, { away: true });
      refresh();
      expect(shownBars()).toHaveLength(0);
      expect(shownChevrons()).toHaveLength(1);

      // 目标在侧面（转过 90°）同样在视野外
      view(tank, 400, { turnLeftDeg: 90 });
      refresh();
      expect(shownBars()).toHaveLength(0);
      expect(shownChevrons()).toHaveLength(1);

      view(tank, 400);
      refresh();
      expect(shownBars()).toHaveLength(1);
      expect(shownChevrons()).toHaveLength(0);
    });

    it('keeps the distance up to date as the player closes in', () => {
      const tank = spawn(UnitType.TANK);
      view(tank, 1500, { away: true });
      refresh();
      const label = onlyChevron().querySelector('.offscreen-chevron-distance');
      expect(Math.abs(metres(label?.textContent) - 1500)).toBeLessThanOrEqual(75);
      view(tank, 400, { away: true });
      refresh();
      expect(Math.abs(metres(label?.textContent) - 400)).toBeLessThanOrEqual(20);
    });

    it('shows one chevron per off-screen hostile unit and none for bystanders', () => {
      const tank = spawn(UnitType.TANK);
      spawn(UnitType.FRIGATE);
      spawn(UnitType.BOMBER);
      spawn(UnitType.CIVILIAN_SHIP);
      spawn(UnitType.ALLY_CONVOY);
      view(tank, 300);
      refresh();
      expect(shownBars()).toHaveLength(1);
      expect(shownChevrons()).toHaveLength(2);
    });
  });

  // ───────────────────────────── M2：小目标的目标框 ─────────────────────────────

  describe('bracket around a small target', () => {
    it('draws a square bracket on a far-away unit, at its place on screen', () => {
      const tank = spawn(UnitType.TANK);
      view(tank, 1200);
      refresh();
      const bracket = onlyBracket();
      expect(px(bracket.style.width)).toBe(px(bracket.style.height));
      expect(px(bracket.style.width)).toBeGreaterThanOrEqual(16);
      expect(bracket.querySelector('.enemy-target-bracket-frame'), 'the frame').toBeTruthy();

      const at = screenPoint(tank);
      expect(at.x).toBeCloseTo(VIEW_WIDTH / 2, 0);
      expect(Math.abs(px(bracket.style.left) - at.x)).toBeLessThan(6);
      expect(Math.abs(px(bracket.style.top) - at.y)).toBeLessThan(6);
    });

    it('follows the target across the screen', () => {
      const tank = spawn(UnitType.TANK);
      view(tank, 1200, { turnLeftDeg: 14 });
      refresh();
      const right = onlyBracket();
      const atRight = screenPoint(tank);
      expect(atRight.x).toBeGreaterThan(VIEW_WIDTH / 2 + 80);
      expect(Math.abs(px(right.style.left) - atRight.x)).toBeLessThan(6);
      expect(Math.abs(px(right.style.top) - atRight.y)).toBeLessThan(6);

      view(tank, 1200, { turnLeftDeg: -14 });
      refresh();
      const left = onlyBracket();
      const atLeft = screenPoint(tank);
      expect(atLeft.x).toBeLessThan(VIEW_WIDTH / 2 - 80);
      expect(Math.abs(px(left.style.left) - atLeft.x)).toBeLessThan(6);
    });

    it.each([
      [1233, 1230],
      [1237, 1240],
      [996, 1000],
      [2004, 2000],
      [3148, 3150],
      [412, 410],
    ])('writes the distance under it rounded to 10 m (%d m → %d m)', (distance, rounded) => {
      const tank = spawn(UnitType.TANK);
      view(tank, distance);
      refresh();
      const label = onlyBracket().querySelector('.enemy-target-bracket-distance');
      expect(label, 'distance label').toBeTruthy();
      expect(metres(label?.textContent)).toBe(rounded);
    });

    it('updates the distance as the player closes in', () => {
      const tank = spawn(UnitType.TANK);
      view(tank, 2503);
      refresh();
      const label = onlyBracket().querySelector('.enemy-target-bracket-distance');
      expect(metres(label?.textContent)).toBe(2500);
      view(tank, 1766);
      refresh();
      expect(metres(label?.textContent)).toBe(1770);
    });

    it('draws no bracket on a unit that is large on screen', () => {
      const tank = spawn(UnitType.TANK);
      view(tank, 60);
      refresh();
      expect(shownBars(), 'the health bar is there').toHaveLength(1);
      expect(shownBrackets()).toHaveLength(0);
    });

    it.each(SURFACE_HOSTILE_TYPES)('brackets a distant %s, not a close one', (type) => {
      const unit = spawn(type);
      const radius = unit.mesh.userData.hitRadius as number;
      expect(radius).toBeGreaterThan(0);
      // 远到命中球在屏幕上不足 10 px；近到命中球占去半个屏幕高
      view(unit, radius * 200);
      refresh();
      expect(shownBrackets(), 'far').toHaveLength(1);
      view(unit, radius * 4);
      refresh();
      expect(shownBrackets(), 'near').toHaveLength(0);
    });

    it('hides the bracket when the unit leaves the view', () => {
      const tank = spawn(UnitType.TANK);
      view(tank, 1200);
      refresh();
      expect(shownBrackets()).toHaveLength(1);
      view(tank, 1200, { away: true });
      refresh();
      expect(shownBrackets()).toHaveLength(0);
      expect(shownChevrons()).toHaveLength(1);
      view(tank, 1200);
      refresh();
      expect(shownBrackets()).toHaveLength(1);
    });

    it('does not bracket enemy jets', () => {
      const jet = new THREE.Object3D();
      jet.name = 'jet-under-test';
      jet.position.set(0, 300, 0);
      jets.push({ mesh: jet, alive: true });
      camera.position.set(0, 300, 3000);
      camera.lookAt(jet.position);
      camera.updateMatrixWorld(true);
      playerPosition.copy(camera.position);
      refresh();
      expect(shownBars()).toHaveLength(1);
      expect(shownBrackets()).toHaveLength(0);
    });

    describe('hysteresis', () => {
      /** 玩家在 distance 米处正对坦克时，目标框是否显示 */
      function bracketAt(tank: UnitInstance, distance: number): boolean {
        view(tank, distance);
        refresh();
        return shownBrackets().length > 0;
      }

      const NEAR = 30;
      const FAR = 4000;
      const COARSE = 1.1;
      const FINE = 1.01;

      /**
       * 由近及远：目标框出现的距离；再由远及近：目标框收起的距离（精确到 1%）。
       * 先用 10% 的步子找到翻转所在的区间，回到起点恢复原来的状态，再在区间里用 1% 的步子细找
       * ——每一趟都只朝一个方向走，滞回不影响结果，刷新次数只有逐 1% 扫一遍的几分之一。
       */
      function thresholds(tank: UnitInstance): { appears: number; disappears: number } {
        expect(bracketAt(tank, NEAR), 'no bracket up close').toBe(false);
        let appears = Number.NaN;
        for (let distance = NEAR; distance < FAR && Number.isNaN(appears); distance *= COARSE) {
          if (!bracketAt(tank, distance)) continue;
          expect(bracketAt(tank, NEAR), 'no bracket up close').toBe(false);
          for (let fine = distance / COARSE; Number.isNaN(appears); fine *= FINE) {
            if (bracketAt(tank, fine)) appears = fine;
          }
        }
        expect(appears, 'the bracket appears as the target shrinks').not.toBeNaN();

        expect(bracketAt(tank, FAR)).toBe(true);
        let disappears = Number.NaN;
        for (let distance = FAR; distance > 20 && Number.isNaN(disappears); distance /= COARSE) {
          if (bracketAt(tank, distance)) continue;
          expect(bracketAt(tank, FAR), 'bracketed far away').toBe(true);
          for (let fine = distance * COARSE; Number.isNaN(disappears); fine /= FINE) {
            if (!bracketAt(tank, fine)) disappears = fine;
          }
        }
        expect(disappears, 'the bracket goes away as the target grows').not.toBeNaN();
        return { appears, disappears };
      }

      it('appears below about 22 px and only goes away above about 28 px', () => {
        const tank = spawn(UnitType.TANK);
        const { appears, disappears } = thresholds(tank);

        // 屏幕上的大小与距离成反比：两个距离之比就是两个像素阈值之比 28 / 22
        expect(disappears).toBeLessThan(appears);
        expect(appears / disappears).toBeGreaterThan(1.21);
        expect(appears / disappears).toBeLessThan(1.34);

        // 出现时，命中球在屏幕上的直径（可见轮廓不会比它大，也不至于小过它的三分之一）
        const radius = tank.mesh.userData.hitRadius as number;
        const pixelsPerRadian = VIEW_HEIGHT / 2 / Math.tan(THREE.MathUtils.degToRad(75 / 2));
        const sphereDiameterPx = ((2 * radius) / appears) * pixelsPerRadian;
        expect(sphereDiameterPx).toBeGreaterThanOrEqual(22);
        expect(sphereDiameterPx).toBeLessThanOrEqual(66);
      });

      it('between the two thresholds the bracket keeps whatever state it had', () => {
        const tank = spawn(UnitType.TANK);
        const { appears, disappears } = thresholds(tank);
        const between = Math.sqrt(appears * disappears);

        expect(bracketAt(tank, disappears * 0.5), 'close').toBe(false);
        expect(bracketAt(tank, between), 'coming from close: still hidden').toBe(false);
        expect(bracketAt(tank, appears * 2), 'far').toBe(true);
        expect(bracketAt(tank, between), 'coming from far: still shown').toBe(true);

        // 在阈值附近来回抖动不会闪烁
        const states = new Set<boolean>();
        for (let i = 0; i < 20; i++) {
          states.add(bracketAt(tank, between * (i % 2 === 0 ? 1.03 : 0.97)));
        }
        expect([...states]).toEqual([true]);
      });

      it('uses the same pixel thresholds whatever the size of the unit', () => {
        const tank = spawn(UnitType.TANK);
        const frigate = spawn(UnitType.FRIGATE);
        const tankRadius = tank.mesh.userData.hitRadius as number;
        const frigateRadius = frigate.mesh.userData.hitRadius as number;
        expect(frigateRadius).not.toBe(tankRadius);

        const small = thresholds(tank);
        const large = thresholds(frigate);
        expect(large.appears / small.appears).toBeCloseTo(frigateRadius / tankRadius, 1);
        expect(large.disappears / small.disappears).toBeCloseTo(frigateRadius / tankRadius, 1);
      });
    });
  });

  // ───────────────────────────── M3：当前目标 ─────────────────────────────

  describe('objective treatment once the jets are gone', () => {
    it('always brackets the remaining units and marks the bracket is-objective', () => {
      const tank = spawn(UnitType.TANK);
      view(tank, 60);
      step(false);
      view(tank, 60);
      refresh();
      expect(shownBrackets(), 'a close unit has no bracket while jets are alive').toHaveLength(0);

      step(true);
      expect(controller.isObjectiveActive()).toBe(true);
      view(tank, 60);
      refresh();
      expect(fedEnemies).toHaveLength(1);
      expect(fedEnemies[0].objective).toBe(true);
      const bracket = onlyBracket();
      expect(bracket.classList.contains(OBJECTIVE_CLASS)).toBe(true);
      expect(px(bracket.style.width)).toBe(px(bracket.style.height));
      expect(metres(bracket.querySelector('.enemy-target-bracket-distance')?.textContent)).toBe(60);
    });

    it('marks an already bracketed far unit is-objective', () => {
      const tank = spawn(UnitType.TANK);
      view(tank, 1500);
      step(false);
      view(tank, 1500);
      refresh();
      expect(onlyBracket().classList.contains(OBJECTIVE_CLASS), 'jets alive').toBe(false);
      expect(fedEnemies[0].objective).toBe(false);

      step(true);
      view(tank, 1500);
      refresh();
      expect(onlyBracket().classList.contains(OBJECTIVE_CLASS), 'jets cleared').toBe(true);
    });

    it('marks the off-screen chevron is-objective', () => {
      const tank = spawn(UnitType.TANK);
      view(tank, 900, { away: true });
      step(false);
      view(tank, 900, { away: true });
      refresh();
      expect(onlyChevron().classList.contains(OBJECTIVE_CLASS), 'jets alive').toBe(false);

      step(true);
      view(tank, 900, { away: true });
      refresh();
      const chevron = onlyChevron();
      expect(chevron.classList.contains(OBJECTIVE_CLASS), 'jets cleared').toBe(true);
      expect(shownBrackets(), 'no bracket off screen').toHaveLength(0);
    });

    it('keeps the objective look as the unit moves between the view and the screen edge', () => {
      const tank = spawn(UnitType.TANK);
      view(tank, 80, { away: true });
      step(true);
      view(tank, 80, { away: true });
      refresh();
      expect(onlyChevron().classList.contains(OBJECTIVE_CLASS)).toBe(true);

      // 转过来对准它：目标框第一次出现就带目标样式
      view(tank, 80);
      refresh();
      expect(shownChevrons()).toHaveLength(0);
      expect(onlyBracket().classList.contains(OBJECTIVE_CLASS)).toBe(true);

      view(tank, 80, { away: true });
      refresh();
      expect(shownBrackets()).toHaveLength(0);
      expect(onlyChevron().classList.contains(OBJECTIVE_CLASS)).toBe(true);
    });

    it('treats every remaining hostile unit as an objective, and only those', () => {
      const tank = spawn(UnitType.TANK);
      const frigate = spawn(UnitType.FRIGATE);
      const bomber = spawn(UnitType.BOMBER);
      spawn(UnitType.CIVILIAN_TRUCK);
      spawn(UnitType.ALLY_FRIGATE);
      view(tank, 80);
      step(true);

      for (const unit of [tank, frigate, bomber]) {
        view(unit, 80);
        refresh();
        expect(
          fedEnemies.map((bar) => bar.objective),
          unit.type
        ).toEqual([true, true, true]);
        expect(onlyBracket().classList.contains(OBJECTIVE_CLASS), `${unit.type} bracket`).toBe(
          true
        );
        const chevrons = shownChevrons();
        expect(chevrons, `${unit.type}: the other two are off screen`).toHaveLength(2);
        for (const chevron of chevrons) {
          expect(chevron.classList.contains(OBJECTIVE_CLASS)).toBe(true);
        }
      }
    });

    it('goes back to the normal look when the units no longer hold a cleared wave', () => {
      const tank = spawn(UnitType.TANK);
      view(tank, 60);
      step(true);
      view(tank, 60);
      refresh();
      expect(onlyBracket().classList.contains(OBJECTIVE_CLASS)).toBe(true);

      // 下一波开始（敌机又来了）：标记恢复平常样式，近处的单位不再画框
      controller.spawnForWave(1, 1, playerPosition);
      expect(controller.isObjectiveActive()).toBe(false);
      view(tank, 60);
      refresh();
      expect(fedEnemies.find((bar) => bar.mesh === tank.mesh)?.objective).toBe(false);
      expect(all(`.enemy-target-bracket.${OBJECTIVE_CLASS}`).filter(isShown)).toHaveLength(0);
      expect(all(`.enemy-arrow-indicator.${OBJECTIVE_CLASS}`)).toHaveLength(0);
      expect(
        shownBrackets().filter((bracket) => {
          const at = screenPoint(tank);
          return Math.abs(px(bracket.style.left) - at.x) < 40;
        }),
        'the close tank has no bracket any more'
      ).toHaveLength(0);
    });

    it('drops the objective look from an off-screen chevron as well', () => {
      const tank = spawn(UnitType.TANK);
      view(tank, 900, { away: true });
      step(true);
      view(tank, 900, { away: true });
      refresh();
      expect(onlyChevron().classList.contains(OBJECTIVE_CLASS)).toBe(true);

      step(false);
      expect(controller.isObjectiveActive()).toBe(false);
      view(tank, 900, { away: true });
      refresh();
      expect(onlyChevron().classList.contains(OBJECTIVE_CLASS)).toBe(false);

      // 远处的单位仍然有目标框，但不再是目标样式
      view(tank, 900);
      refresh();
      expect(onlyBracket().classList.contains(OBJECTIVE_CLASS)).toBe(false);
    });

    it('never marks jets as objectives', () => {
      const tank = spawn(UnitType.TANK);
      const jet = new THREE.Object3D();
      jet.name = 'jet-under-test';
      jet.position.copy(positionOf(tank)).add(new THREE.Vector3(0, 60, 0));
      jets.push({ mesh: jet, alive: true });
      view(tank, 80);
      step(true);
      view(tank, 80);
      refresh();
      expect(fedEnemies.find((bar) => bar.mesh === jet)?.objective).toBe(false);
      expect(fedEnemies.find((bar) => bar.mesh === tank.mesh)?.objective).toBe(true);
      expect(shownBrackets(), 'only the unit is bracketed').toHaveLength(1);
    });
  });
});
