import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Faction } from '@/core/Faction';
import { GameCoordinator } from '@/core/GameCoordinator';
import type { RadarBlip } from '@/core/PresentationController';
import type { EnemyAI } from '@/features/enemy/EnemyAI';
import { ENEMY_CONFIGS, EnemyType } from '@/features/enemy/EnemyTypes';
import type { FriendlyAI } from '@/features/enemy/FriendlyAI';
import type { UnitInstance } from '@/features/units/UnitSystem';
import { UNIT_CONFIGS, UNIT_TYPES, UnitType } from '@/features/units/UnitTypes';
import { tr, type LocalizedText } from '@/i18n';
import {
  addedShapes,
  centreOf,
  isLineSegment,
  type PaintedShape,
  type Point,
} from './canvasRecorder';
import {
  createCombatHudRig,
  pixels,
  readBar,
  type CombatHudRig,
  type RadarDrawing,
} from './combatHudRig';

/**
 * 隐形中的敌机与战斗 HUD（敌机编队规格 §3 WRAITH）：
 * “隐形时不能被锁定，没有雷达光点、没有血条、没有目标标记、没有机炮前置标记……它仍然会受伤。”
 *
 * 这里只看 HUD 这一侧——战斗 HUD 馈送（CombatHudFeed）之后的雷达盘、展开的关卡地图、血条与名称、
 * 目标框、屏幕外箭头，以及 HUD 的敌人计数：
 * - 隐形中的敌机在这些地方都没有；重新可见后的第一次刷新就都回来；
 * - 同一帧里别的敌机、僚机和地面 / 海上 / 空中单位不受影响；
 * - 隐形中的敌机还活着，仍然计入“ENEMIES n”。
 * 隐形周期本身、锁定与机炮前置标记的接线由别的用例负责，这里不重复。
 *
 * 整条链路是真实的（见 combatHudRig.ts）。除最后一组用真实隐形机自己走隐形周期外，“隐形中”由
 * rig.cloak() 让一架真实敌机的 isCloaked() 报告出来——那是敌机与 HUD 之间唯一的接口。
 */

const PLAYER = new THREE.Vector3(0, 300, 0);
/** 玩家朝北（-Z）看 */
const AHEAD = new THREE.Vector3(0, 300, -400);

// 画面里：右前方的隐形机、左前方的战斗机、近处的僚机；画面外：身后的重型机
const WRAITH_AHEAD = new THREE.Vector3(140, 320, -300);
const WRAITH_BEHIND = new THREE.Vector3(-120, 330, 380);
const FIGHTER_AHEAD = new THREE.Vector3(-150, 290, -340);
const HEAVY_BEHIND = new THREE.Vector3(80, 310, 420);
const WINGMAN_AHEAD = new THREE.Vector3(-40, 305, -150);
const TANK_AHEAD = new THREE.Vector3(60, 0, -520);
const BOMBER_BEHIND = new THREE.Vector3(-420, 520, 300);
const CONVOY_BEHIND = new THREE.Vector3(250, 0, 500);
const LINER_AHEAD = new THREE.Vector3(-500, 600, -600);

const CALLSIGN: LocalizedText = { en: 'Viper', zh: '蝰蛇' };

interface Cast {
  wraith: EnemyAI | null;
  fighter: EnemyAI;
  heavy: EnemyAI;
  wingman: FriendlyAI;
  tank: UnitInstance;
  bomber: UnitInstance;
  convoy: UnitInstance;
  liner: UnitInstance;
}

interface CastOptions {
  /** 隐形机摆在哪里；null = 这个世界里根本没有它 */
  wraithAt?: THREE.Vector3 | null;
}

function sameDrawing(actual: readonly PaintedShape[], expected: readonly PaintedShape[]): void {
  expect(addedShapes(expected, actual), 'shapes that should not be there').toEqual([]);
  expect(addedShapes(actual, expected), 'shapes that are missing').toEqual([]);
}

/** 多画出来的那个目标符号的中心（量程外符号的朝外短线不算） */
function glyphCentre(added: readonly PaintedShape[]): Point {
  const glyph = added.filter((shape) => !isLineSegment(shape));
  expect(glyph.length, 'a contact glyph').toBeGreaterThan(0);
  return centreOf(glyph);
}

describe('a cloaked jet and the combat HUD', () => {
  let rig: CombatHudRig | null = null;
  let randomSpy: { mockRestore(): void } | null = null;

  /** 一个新的世界（上一个先收掉：两个世界共用同一份 DOM） */
  async function world(): Promise<CombatHudRig> {
    rig?.dispose();
    rig = await createCombatHudRig();
    rig.lookFrom(PLAYER, AHEAD);
    return rig;
  }

  afterEach(() => {
    rig?.dispose();
    rig = null;
    randomSpy?.mockRestore();
    randomSpy = null;
  });

  function populate(target: CombatHudRig, options: CastOptions = {}): Cast {
    const wraithAt = options.wraithAt === undefined ? WRAITH_AHEAD : options.wraithAt;
    const fighter = target.spawnJet(EnemyType.FIGHTER, FIGHTER_AHEAD);
    // 隐形机排在敌机列表中间
    const wraith = wraithAt ? target.spawnJet(EnemyType.WRAITH, wraithAt) : null;
    const heavy = target.spawnJet(EnemyType.HEAVY, HEAVY_BEHIND);
    return {
      wraith,
      fighter,
      heavy,
      wingman: target.spawnWingman(WINGMAN_AHEAD, CALLSIGN),
      tank: target.spawnUnit(UnitType.TANK, TANK_AHEAD),
      bomber: target.spawnUnit(UnitType.BOMBER, BOMBER_BEHIND),
      convoy: target.spawnUnit(UnitType.ALLY_CONVOY, CONVOY_BEHIND),
      liner: target.spawnUnit(UnitType.CIVILIAN_AIRLINER, LINER_AHEAD),
    };
  }

  const wraithOf = (cast: Cast): EnemyAI => {
    expect(cast.wraith, 'this world has a Wraith').not.toBeNull();
    return cast.wraith as EnemyAI;
  };
  const placeOf = (jet: EnemyAI): THREE.Vector3 => jet.getMesh().position;
  const nameOf = (type: EnemyType): string => tr(ENEMY_CONFIGS[type].name);

  /** 喂给血条层的敌方快照：网格 → [当前血量, 最大血量] */
  function fedHealth(target: CombatHudRig): Map<THREE.Object3D, [number, number]> {
    return new Map(
      target.fed.enemies.map((bar) => [bar.mesh, [bar.currentHealth, bar.maxHealth]] as const)
    );
  }

  function ownHealth(jet: EnemyAI): [number, number] {
    const health = jet.getHealth();
    return [health.current, health.max];
  }

  // ───────────────────────────── 喂给 HUD 的东西 ─────────────────────────────

  describe('what the HUD is fed', () => {
    it('leaves a cloaked jet out of the radar contacts and out of the marker snapshot', async () => {
      const hudRig = await world();
      const cast = populate(hudRig);
      const wraith = wraithOf(cast);
      hudRig.hudFrame();
      expect(hudRig.blipAt(placeOf(wraith)), 'visible: a radar contact').toBe('enemy');
      expect(hudRig.fedBar(wraith.getMesh()), 'visible: in the marker snapshot').toBeDefined();
      const contactsBefore = hudRig.fed.blips.length;
      const markersBefore = hudRig.fed.enemies.length;

      hudRig.cloak(wraith, true);
      hudRig.hudFrame();
      expect(hudRig.blipAt(placeOf(wraith)), 'cloaked: no radar contact').toBeUndefined();
      expect(
        hudRig.fedBar(wraith.getMesh()),
        'cloaked: not in the marker snapshot'
      ).toBeUndefined();
      expect(hudRig.fed.blips, 'only that one contact is gone').toHaveLength(contactsBefore - 1);
      expect(hudRig.fed.enemies, 'only that one marker is gone').toHaveLength(markersBefore - 1);
      expect(wraith.isAlive()).toBe(true);
    });

    it('feeds it again on the first refresh after it is visible, with its current health', async () => {
      const hudRig = await world();
      const cast = populate(hudRig);
      const wraith = wraithOf(cast);
      hudRig.cloak(wraith, true);
      hudRig.hudFrame();
      hudRig.hudFrame();
      expect(hudRig.fedBar(wraith.getMesh())).toBeUndefined();

      // 隐形中仍然会受伤
      const before = wraith.getHealth().current;
      wraith.takeDamage(30);
      expect(wraith.getHealth().current).toBeLessThan(before);
      hudRig.hudFrame();
      expect(hudRig.fedBar(wraith.getMesh()), 'still cloaked').toBeUndefined();

      hudRig.cloak(wraith, false);
      hudRig.hudFrame();
      expect(hudRig.blipAt(placeOf(wraith))).toBe('enemy');
      const [current, max] = ownHealth(wraith);
      expect(hudRig.fedBar(wraith.getMesh())).toMatchObject({
        currentHealth: current,
        maxHealth: max,
        objective: false,
      });
    });

    it.each([
      ['first', 0],
      ['in the middle', 1],
      ['in the middle, further on', 2],
      ['last', 3],
    ])(
      'feeds every other jet as before when the cloaked one is %s in the list',
      async (_name, index) => {
        const hudRig = await world();
        const types = [EnemyType.FIGHTER, EnemyType.HEAVY, EnemyType.ACE];
        types.splice(index, 0, EnemyType.WRAITH);
        const jets = types.map((type, order) =>
          hudRig.spawnJet(type, new THREE.Vector3(-180 + order * 110, 300 + order * 8, -350))
        );
        // 每架受的伤不一样：血量对不上号就看得出来
        jets.forEach((jet, order) => jet.takeDamage(11 * (order + 1)));
        const wraith = jets[index];
        const others = jets.filter((jet) => jet !== wraith);

        hudRig.cloak(wraith, true);
        hudRig.hudFrame();
        expect(hudRig.fed.enemies.map((bar) => bar.mesh)).toEqual(
          others.map((jet) => jet.getMesh())
        );
        const fed = fedHealth(hudRig);
        for (const jet of others) {
          expect(fed.get(jet.getMesh()), jet.getConfig().type).toEqual(ownHealth(jet));
          expect(hudRig.blipAt(placeOf(jet)), jet.getConfig().type).toBe('enemy');
        }
        expect(hudRig.fed.blips).toHaveLength(others.length);

        hudRig.cloak(wraith, false);
        hudRig.hudFrame();
        expect(hudRig.fed.enemies.map((bar) => bar.mesh)).toEqual(jets.map((jet) => jet.getMesh()));
        const back = fedHealth(hudRig);
        for (const jet of jets) {
          expect(back.get(jet.getMesh()), jet.getConfig().type).toEqual(ownHealth(jet));
          expect(hudRig.blipAt(placeOf(jet)), jet.getConfig().type).toBe('enemy');
        }
      }
    );

    it('lets two cloaked jets come and go independently', async () => {
      const hudRig = await world();
      const first = hudRig.spawnJet(EnemyType.WRAITH, WRAITH_AHEAD);
      const fighter = hudRig.spawnJet(EnemyType.FIGHTER, FIGHTER_AHEAD);
      const second = hudRig.spawnJet(EnemyType.WRAITH, WRAITH_BEHIND);
      const fedJets = (): EnemyAI[] =>
        [first, fighter, second].filter((jet) => hudRig.fedBar(jet.getMesh()) !== undefined);
      const contacts = (): EnemyAI[] =>
        [first, fighter, second].filter((jet) => hudRig.blipAt(placeOf(jet)) !== undefined);

      const steps: Array<[first: boolean, second: boolean]> = [
        [true, true],
        [false, true],
        [true, false],
        [false, false],
        [true, true],
      ];
      for (const [firstHidden, secondHidden] of steps) {
        hudRig.cloak(first, firstHidden);
        hudRig.cloak(second, secondHidden);
        hudRig.hudFrame();
        const expected = [first, fighter, second].filter(
          (jet) => !(jet === first && firstHidden) && !(jet === second && secondHidden)
        );
        expect(fedJets(), `markers (${firstHidden}, ${secondHidden})`).toEqual(expected);
        expect(contacts(), `contacts (${firstHidden}, ${secondHidden})`).toEqual(expected);
      }
    });

    it('never feeds a jet as an objective, before, during or after a cloak', async () => {
      const hudRig = await world();
      const cast = populate(hudRig);
      const wraith = wraithOf(cast);
      for (const hidden of [false, true, false]) {
        hudRig.cloak(wraith, hidden);
        hudRig.hudFrame();
        for (const jet of [wraith, cast.fighter, cast.heavy]) {
          expect(hudRig.fedBar(jet.getMesh())?.objective ?? false).toBe(false);
        }
        // 画面上唯一的目标框是 500 米外那辆坦克的：敌机不带目标框，隐形前后都一样
        const brackets = hudRig.shownBrackets();
        expect(brackets, `brackets (cloaked: ${hidden})`).toHaveLength(1);
        const tankAt = hudRig.screenPoint(cast.tank.mesh.position);
        expect(Math.abs(pixels(brackets[0].style.left, 'bracket left') - tankAt.x)).toBeLessThan(3);
        expect(Math.abs(pixels(brackets[0].style.top, 'bracket top') - tankAt.y)).toBeLessThan(3);
      }
    });
  });

  // ───────────────────────────── 雷达盘与关卡地图 ─────────────────────────────

  describe('radar dial and level map', () => {
    /** 建一个世界、展开地图，画一次 */
    async function drawingOf(setup: (target: CombatHudRig) => void): Promise<RadarDrawing> {
      const hudRig = await world();
      setup(hudRig);
      hudRig.openMap();
      return hudRig.drawRadar();
    }

    function dialCentre(): Point {
      const canvas = document.querySelector<HTMLCanvasElement>('#radar-minimap canvas');
      expect(canvas).toBeTruthy();
      const size = (canvas as HTMLCanvasElement).width;
      expect(size).toBeGreaterThan(0);
      return { x: size / 2, y: size / 2 };
    }

    function mapCentre(): Point {
      const map = document.getElementById('radar-map');
      expect(map).toBeTruthy();
      // 地图是正方形，下面多出一条图例：以宽度为边长
      const side = pixels((map as HTMLElement).style.width, 'map width');
      return { x: side / 2, y: side / 2 };
    }

    it('draws no blip for a cloaked jet, on the dial or on the map', async () => {
      const without = await drawingOf((target) => populate(target, { wraithAt: null }));
      const visible = await drawingOf((target) => populate(target));
      const cloaked = await drawingOf((target) => {
        const cast = populate(target);
        target.cloak(wraithOf(cast), true);
      });

      // 前提：可见的隐形机在雷达盘和地图上各多出一个符号
      expect(addedShapes(without.dial, visible.dial).length).toBeGreaterThan(0);
      expect(addedShapes(without.map, visible.map).length).toBeGreaterThan(0);

      // 隐形中：画出来的与“这架敌机根本不存在”一模一样
      sameDrawing(cloaked.dial, without.dial);
      sameDrawing(cloaked.map, without.map);
    });

    it('draws the blip again on the first radar refresh after it is visible; nothing else moves', async () => {
      const hudRig = await world();
      const cast = populate(hudRig);
      const wraith = wraithOf(cast);
      hudRig.openMap();

      const shown = hudRig.drawRadar();
      hudRig.cloak(wraith, true);
      const hidden = hudRig.drawRadar();
      hudRig.cloak(wraith, false);
      const back = hudRig.drawRadar();

      // 隐形时少掉的只有一个符号，就在隐形机的位置：玩家朝北，它在右前方
      for (const [name, before, after, centre] of [
        ['dial', shown.dial, hidden.dial, dialCentre()],
        ['map', shown.map, hidden.map, mapCentre()],
      ] as const) {
        expect(addedShapes(before, after), `${name}: nothing new while cloaked`).toEqual([]);
        const gone = glyphCentre(addedShapes(after, before));
        expect(gone.x, `${name}: east of the centre`).toBeGreaterThan(centre.x + 3);
        expect(gone.y, `${name}: north of the centre`).toBeLessThan(centre.y - 3);
      }
      sameDrawing(back.dial, shown.dial);
      sameDrawing(back.map, shown.map);
    });

    it('keeps it off the radar for as long as it stays cloaked', async () => {
      const hudRig = await world();
      const cast = populate(hudRig);
      const wraith = wraithOf(cast);
      hudRig.cloak(wraith, true);
      const first = hudRig.drawRadar();
      for (let refresh = 0; refresh < 100; refresh++) hudRig.refreshRadar();
      sameDrawing(hudRig.drawRadar().dial, first.dial);
      expect(hudRig.blipAt(placeOf(wraith))).toBeUndefined();
    });
  });

  // ───────────────────────────── 血条、名称、目标框、屏幕外箭头 ─────────────────────────────

  describe('health bar, name and off-screen chevron', () => {
    it('in view: no health bar and no name while cloaked; both back on the first frame it is visible', async () => {
      const hudRig = await world();
      const cast = populate(hudRig);
      const wraith = wraithOf(cast);
      hudRig.hudFrame();
      const before = hudRig.barOf(wraith.getMesh());
      expect(before, 'visible: a health bar').not.toBeNull();
      expect(readBar(before as HTMLElement)).toMatchObject({
        name: nameOf(EnemyType.WRAITH),
        fill: 1,
      });

      hudRig.cloak(wraith, true);
      hudRig.hudFrame();
      expect(hudRig.barOf(wraith.getMesh()), 'cloaked: no health bar').toBeNull();
      expect(hudRig.chevronOf(wraith.getMesh()), 'cloaked: no chevron either').toBeNull();
      const names = hudRig.shownBars().map((bar) => readBar(bar).name);
      expect(names, 'cloaked: its name is nowhere').not.toContain(nameOf(EnemyType.WRAITH));

      // 隐形中受了伤：回来时血条是现在的血量
      wraith.takeDamage(44);
      hudRig.hudFrame();
      expect(hudRig.barOf(wraith.getMesh()), 'still cloaked').toBeNull();

      hudRig.cloak(wraith, false);
      hudRig.hudFrame();
      const back = hudRig.barOf(wraith.getMesh());
      expect(back, 'visible again: the health bar is back on that frame').not.toBeNull();
      const health = wraith.getHealth();
      const drawn = readBar(back as HTMLElement);
      expect(drawn.name).toBe(nameOf(EnemyType.WRAITH));
      expect(drawn.fill).toBeCloseTo(health.current / health.max, 5);
      expect(drawn.fill).toBeLessThan(1);
    });

    it('in view: the bar is back even if nothing has moved since the last HUD frame', async () => {
      const hudRig = await world();
      const wraith = wraithOf(populate(hudRig));
      hudRig.hudFrame();
      hudRig.cloak(wraith, true);
      hudRig.refreshBars();
      expect(hudRig.barOf(wraith.getMesh())).toBeNull();
      hudRig.cloak(wraith, false);
      hudRig.refreshBars();
      expect(hudRig.barOf(wraith.getMesh())).not.toBeNull();
    });

    it('out of view: no off-screen chevron while cloaked; back on the first frame it is visible', async () => {
      const hudRig = await world();
      const cast = populate(hudRig, { wraithAt: WRAITH_BEHIND });
      const wraith = wraithOf(cast);
      hudRig.hudFrame();
      expect(hudRig.chevronOf(wraith.getMesh()), 'visible: an off-screen chevron').not.toBeNull();
      expect(hudRig.barOf(wraith.getMesh())).toBeNull();
      const chevrons = hudRig.shownChevrons().length;

      hudRig.cloak(wraith, true);
      hudRig.hudFrame();
      expect(hudRig.chevronOf(wraith.getMesh()), 'cloaked: no chevron').toBeNull();
      expect(hudRig.shownChevrons(), 'only that one chevron is gone').toHaveLength(chevrons - 1);
      expect(hudRig.barOf(wraith.getMesh())).toBeNull();
      hudRig.hudFrame();
      expect(hudRig.chevronOf(wraith.getMesh()), 'still cloaked').toBeNull();

      hudRig.cloak(wraith, false);
      hudRig.hudFrame();
      expect(
        hudRig.chevronOf(wraith.getMesh()),
        'visible again: the chevron is back on that frame'
      ).not.toBeNull();
      expect(hudRig.shownChevrons()).toHaveLength(chevrons);
    });

    /**
     * 画面外的隐形机隐形、又现形，其间玩家和相机都不动。
     * 返回现形后第一帧（什么都没动）有没有箭头；前面几步是前提，在这里就断言掉。
     */
    async function returnsWhileNothingMoves(): Promise<{
      hudRig: CombatHudRig;
      wraith: EnemyAI;
      shownAtOnce: boolean;
    }> {
      const hudRig = await world();
      const wraith = wraithOf(populate(hudRig, { wraithAt: WRAITH_BEHIND }));
      hudRig.hudFrame();
      expect(hudRig.chevronOf(wraith.getMesh()), 'visible: a chevron').not.toBeNull();
      hudRig.cloak(wraith, true);
      hudRig.refreshBars();
      expect(hudRig.chevronOf(wraith.getMesh()), 'cloaked: no chevron').toBeNull();
      hudRig.cloak(wraith, false);
      hudRig.refreshBars();
      expect(hudRig.fedBar(wraith.getMesh()), 'visible again: fed to the markers').toBeDefined();
      return { hudRig, wraith, shownAtOnce: hudRig.chevronOf(wraith.getMesh()) !== null };
    }

    /*
     * FINDING（原有的省略刷新，不只影响隐形机）：一个目标的标记是新建的、目标又在画面外时，
     * 只有相机或玩家从上一帧 HUD 以来动过（各 0.1 米以上），箭头才会画出来——两者都没动的话，
     * 重新可见的隐形机没有箭头，要等到有东西动了才出现。飞行中玩家每一帧都在动，所以平时看不到；
     * 玩家和相机都静止的那一段里现形的敌机会晚一些才有箭头。
     * 依据是任务书的要求“可见的那一帧就全部回来”（规格 §3 只说隐形时没有哪些东西）。
     */
    it.fails(
      'out of view: the chevron is back even if nothing has moved since the last HUD frame',
      async () => {
        const { shownAtOnce } = await returnsWhileNothingMoves();
        expect(shownAtOnce).toBe(true);
      }
    );

    it('out of view, nothing moved: the chevron is back at the latest once the player moves', async () => {
      // 上面那条 it.fails 的前提都成立（这里不是 it.fails，前提不成立就会失败）
      const { hudRig, wraith } = await returnsWhileNothingMoves();
      hudRig.hudFrame(0.5);
      expect(hudRig.chevronOf(wraith.getMesh())).not.toBeNull();
    });

    it('cloaks in view and shows up again behind the player: the bar goes, a chevron comes back', async () => {
      const hudRig = await world();
      const wraith = wraithOf(populate(hudRig));
      hudRig.hudFrame();
      expect(hudRig.barOf(wraith.getMesh())).not.toBeNull();

      hudRig.cloak(wraith, true);
      hudRig.hudFrame();
      // 隐形时绕到了玩家身后
      placeOf(wraith).copy(WRAITH_BEHIND);
      wraith.getMesh().updateMatrixWorld(true);
      hudRig.hudFrame();
      expect(hudRig.barOf(wraith.getMesh())).toBeNull();
      expect(hudRig.chevronOf(wraith.getMesh())).toBeNull();

      hudRig.cloak(wraith, false);
      hudRig.hudFrame();
      expect(hudRig.barOf(wraith.getMesh())).toBeNull();
      expect(hudRig.chevronOf(wraith.getMesh())).not.toBeNull();
    });

    it('leaves the markers of everything else exactly where they would have been', async () => {
      /** 每一帧里别的目标在画面上的样子；plan[i] = 第 i 帧隐形机是否隐形 */
      async function others(plan: readonly boolean[]): Promise<unknown[]> {
        const hudRig = await world();
        const cast = populate(hudRig);
        const wraith = wraithOf(cast);
        const frames: unknown[] = [];
        for (const hidden of plan) {
          hudRig.cloak(wraith, hidden);
          hudRig.hudFrame();
          const bar = (mesh: THREE.Object3D): unknown => {
            const found = hudRig.barOf(mesh);
            return found ? readBar(found) : null;
          };
          const chevron = (mesh: THREE.Object3D): unknown => {
            const found = hudRig.chevronOf(mesh);
            if (!found) return null;
            return {
              left: found.style.left,
              top: found.style.top,
              arrow: found.querySelector('svg')?.style.transform,
              text: found.querySelector('.offscreen-chevron-distance')?.textContent,
            };
          };
          const snapshot = {
            fighter: bar(cast.fighter.getMesh()),
            wingman: bar(cast.wingman.getMesh()),
            tank: bar(cast.tank.mesh),
            heavy: chevron(cast.heavy.getMesh()),
            bomber: chevron(cast.bomber.mesh),
            brackets: hudRig.shownBrackets().map((bracket) => bracket.style.cssText),
            wraithMarked: hudRig.barOf(wraith.getMesh()) !== null,
          };
          // 前提：这些目标确实各有各的标记
          for (const key of ['fighter', 'wingman', 'tank', 'heavy', 'bomber'] as const) {
            expect(snapshot[key], `${key} is marked`).not.toBeNull();
          }
          frames.push(snapshot);
        }
        return frames;
      }

      const plan = [false, true, true, false, false];
      const never = await others(plan.map(() => false));
      const cloaking = await others(plan);
      expect(cloaking.map((frame) => (frame as { wraithMarked: boolean }).wraithMarked)).toEqual(
        plan.map((hidden) => !hidden)
      );
      const withoutWraith = (frames: unknown[]): unknown[] =>
        frames.map((frame) => ({ ...(frame as object), wraithMarked: undefined }));
      expect(withoutWraith(cloaking)).toEqual(withoutWraith(never));
    });
  });

  // ───────────────────────────── 僚机与单位不受影响 ─────────────────────────────

  describe('wingmen and units are not filtered', () => {
    // 僚机的网格名固定是 'FIGHTER'，与敌方战斗机同名：敌方那一架“隐形”也碍不着僚机
    it.each([EnemyType.WRAITH, EnemyType.FIGHTER])(
      'a wingman keeps its radar contact, health bar and callsign while a %s is cloaked',
      async (type) => {
        const hudRig = await world();
        const named = hudRig.spawnWingman(WINGMAN_AHEAD, CALLSIGN);
        const plain = hudRig.spawnWingman(new THREE.Vector3(90, 300, -180));
        const jet = hudRig.spawnJet(type, WRAITH_AHEAD);
        named.takeDamage(20);

        for (const hidden of [false, true, false]) {
          hudRig.cloak(jet, hidden);
          hudRig.hudFrame();
          expect(hudRig.fed.friendlies.map((bar) => bar.mesh)).toEqual([
            named.getMesh(),
            plain.getMesh(),
          ]);
          for (const wingman of [named, plain]) {
            const health = wingman.getHealth();
            expect(hudRig.blipAt(wingman.getMesh().position)).toBe('ally');
            expect(hudRig.fedBar(wingman.getMesh())).toMatchObject({
              currentHealth: health.current,
              maxHealth: health.max,
            });
            const bar = hudRig.barOf(wingman.getMesh());
            expect(bar, `wingman bar (jet cloaked: ${hidden})`).not.toBeNull();
            expect(readBar(bar as HTMLElement).fill).toBeCloseTo(health.current / health.max, 5);
          }
          expect(readBar(hudRig.barOf(named.getMesh()) as HTMLElement).name).toBe(tr(CALLSIGN));
          expect(readBar(hudRig.barOf(plain.getMesh()) as HTMLElement).name).toBe('Allied Fighter');
          // 那架敌机自己：不管是哪个机型，报告隐形就没有血条和光点
          expect(hudRig.barOf(jet.getMesh()) !== null, 'the bar of the jet itself').toBe(!hidden);
          expect(hudRig.blipAt(placeOf(jet)) !== undefined, 'its radar contact').toBe(!hidden);
        }
      }
    );

    it('every unit keeps its radar contact, and every hostile unit its marker, while a jet is cloaked', async () => {
      const hudRig = await world();
      const units = UNIT_TYPES.map((type, index) => {
        const air = UNIT_CONFIGS[type].domain === 'air';
        const angle = (index / UNIT_TYPES.length) * Math.PI * 2;
        return hudRig.spawnUnit(
          type,
          new THREE.Vector3(Math.sin(angle) * 600, air ? 450 : 0, Math.cos(angle) * 600)
        );
      });
      const wraith = hudRig.spawnJet(EnemyType.WRAITH, WRAITH_AHEAD);
      const fighter = hudRig.spawnJet(EnemyType.FIGHTER, FIGHTER_AHEAD);
      const jetMeshes = new Set<THREE.Object3D>([wraith.getMesh(), fighter.getMesh()]);

      const unitContacts = (): Array<[RadarBlip['kind'], number, number]> =>
        hudRig.fed.blips
          .filter(
            (blip) =>
              blip.position.distanceTo(placeOf(wraith)) > 0.01 &&
              blip.position.distanceTo(placeOf(fighter)) > 0.01
          )
          .map((blip) => [blip.kind, blip.position.x, blip.position.z]);
      const unitMarkers = (): Array<[THREE.Object3D, number, number]> =>
        hudRig.fed.enemies
          .filter((bar) => !jetMeshes.has(bar.mesh))
          .map((bar) => [bar.mesh, bar.currentHealth, bar.maxHealth]);
      const unitsOnScreen = (): number =>
        hudRig.shownBars().length +
        hudRig.shownChevrons().length -
        [wraith, fighter].filter(
          (jet) => hudRig.barOf(jet.getMesh()) ?? hudRig.chevronOf(jet.getMesh())
        ).length;

      hudRig.hudFrame();
      const contacts = unitContacts();
      const markers = unitMarkers();
      const onScreen = unitsOnScreen();
      // 前提：每个单位都是雷达目标；每个打得到的敌方单位都有标记（潜艇开局潜航，没有）
      expect(contacts).toHaveLength(units.length);
      const hostile = units.filter(
        (unit) => UNIT_CONFIGS[unit.type].faction === Faction.ENEMY && unit.isTargetable()
      );
      expect(new Set(markers.map(([mesh]) => mesh))).toEqual(
        new Set(hostile.map((unit) => unit.mesh))
      );
      expect(hostile.length).toBeGreaterThan(5);
      expect(onScreen).toBe(hostile.length);

      for (const hidden of [true, false]) {
        hudRig.cloak(wraith, hidden);
        hudRig.hudFrame();
        expect(unitContacts(), `contacts (jet cloaked: ${hidden})`).toEqual(contacts);
        expect(unitMarkers(), `markers (jet cloaked: ${hidden})`).toEqual(markers);
        expect(unitsOnScreen(), `on screen (jet cloaked: ${hidden})`).toBe(onScreen);
        expect(hudRig.fedBar(wraith.getMesh()) !== undefined).toBe(!hidden);
        expect(hudRig.fedBar(fighter.getMesh())).toBeDefined();
      }
    });
  });

  // ───────────────────────────── 敌人计数 ─────────────────────────────

  describe('the ENEMIES counter', () => {
    const counter = (): string => document.getElementById('hud-wave-line')?.textContent ?? '';

    /**
     * 白盒（与 BossFightEnemyCounter.test.ts 同样的办法）：以真实的 GameCoordinator 原型造一个对象，
     * 只装 updateUI 用到的字段，跑一帧（超过 HUD 节流间隔）。敌机系统、单位、HUD 馈送、表现层、
     * HUD 都是台架里真实的那一套，所以计数、雷达、血条都是这一帧里生产代码算出来的。
     */
    function tick(target: CombatHudRig): void {
      const coordinator = Object.create(GameCoordinator.prototype) as Record<string, unknown>;
      Object.assign(coordinator, {
        hud: target.hud,
        sessionState: target.session,
        presentationController: target.presentation,
        enemySystem: target.enemies,
        units: target.units,
        hudFeed: target.feed,
        playerSystem: {
          getHealth: () => ({ getHealthPercent: () => 100 }),
          getSpeed: () => 0,
          getLives: () => 3,
        },
        gameState: { getScore: () => 0 },
        updatePlayerFacingObjective: vi.fn(),
      });
      const updateUI = (GameCoordinator.prototype as unknown as Record<string, unknown>)
        .updateUI as (deltaTime: number) => void;
      target.fly();
      updateUI.call(coordinator, 1);
    }

    it('still counts a cloaked jet: it is alive', async () => {
      const hudRig = await world();
      const wraith = hudRig.spawnJet(EnemyType.WRAITH, WRAITH_AHEAD);
      hudRig.spawnJet(EnemyType.FIGHTER, FIGHTER_AHEAD);
      tick(hudRig);
      expect(counter()).toMatch(/^ENEMIES 2\b/);
      expect(hudRig.fed.enemies, 'markers').toHaveLength(2);

      hudRig.cloak(wraith, true);
      tick(hudRig);
      expect(hudRig.enemies.getAliveEnemyCount()).toBe(2);
      expect(counter(), 'cloaked: still counted').toMatch(/^ENEMIES 2\b/);
      // 同一帧里它的标记和雷达光点都没有了
      expect(hudRig.fed.enemies, 'markers').toHaveLength(1);
      expect(hudRig.blipAt(placeOf(wraith))).toBeUndefined();

      // 击落之后才不算
      wraith.takeDamage(1e9);
      expect(wraith.isAlive()).toBe(false);
      tick(hudRig);
      expect(counter()).toMatch(/^ENEMIES 1\b/);
    });

    it('counts it together with hostile units, as for any other jet', async () => {
      const hudRig = await world();
      const wraith = hudRig.spawnJet(EnemyType.WRAITH, WRAITH_AHEAD);
      hudRig.spawnUnit(UnitType.TANK, TANK_AHEAD);
      hudRig.spawnUnit(UnitType.ALLY_CONVOY, CONVOY_BEHIND);
      hudRig.cloak(wraith, true);
      tick(hudRig);
      expect(counter()).toMatch(/^ENEMIES 2\b/);
    });
  });

  // ───────────────────────────── 真实的隐形周期 ─────────────────────────────

  describe('a real Wraith flying its own cloak cycle', () => {
    /** 可重复的随机数：隐形机第一次隐形前的等待、机动的选择都用 Math.random */
    function seedRandom(seed: number): void {
      let state = seed >>> 0;
      randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
      });
    }

    it.each([1, 20261010, 987654321])(
      'has a radar contact and a marker exactly while it is not cloaked (seed %i)',
      async (seed) => {
        seedRandom(seed);
        const hudRig = await world();
        const wraith = hudRig.spawnJet(EnemyType.WRAITH, new THREE.Vector3(60, 300, -250));
        const fighter = hudRig.spawnJet(EnemyType.FIGHTER, new THREE.Vector3(-60, 300, -250));
        const step = 1 / 30;
        let wasHidden = false;
        let cloaks = 0;
        let returns = 0;
        let hiddenFrames = 0;

        for (let elapsed = 0; elapsed < 40 && returns < 2; elapsed += step) {
          // 玩家以 30 米 / 秒往前飞；敌机走真实的更新
          hudRig.fly(30 * step);
          hudRig.enemies.updateWithPlayer(step, hudRig.player);
          const refreshes = hudRig.radarRefreshes();
          hudRig.feed.updateRadar(step);
          hudRig.feed.updateHealthBars();

          expect(wraith.isAlive() && fighter.isAlive(), 'nobody shoots the jets down').toBe(true);
          const hidden = wraith.isCloaked();
          if (hidden !== wasHidden) {
            if (hidden) cloaks++;
            else returns++;
            wasHidden = hidden;
          }
          if (hidden) hiddenFrames++;
          const at = `at ${elapsed.toFixed(2)} s (cloaked: ${hidden})`;

          expect(
            hudRig.fed.enemies.map((bar) => bar.mesh),
            `markers fed ${at}`
          ).toEqual(hidden ? [fighter.getMesh()] : [wraith.getMesh(), fighter.getMesh()]);
          // 每架可见的敌机在画面上要么有血条（视野内），要么有箭头（视野外）
          expect(
            hudRig.shownBars().length + hudRig.shownChevrons().length,
            `markers on screen ${at}`
          ).toBe(hidden ? 1 : 2);
          if (hudRig.radarRefreshes() > refreshes) {
            expect(hudRig.blipAt(placeOf(wraith)) !== undefined, `radar contact ${at}`).toBe(
              !hidden
            );
            expect(hudRig.blipAt(placeOf(fighter)), `the Fighter ${at}`).toBe('enemy');
          }
        }

        // 前提：这段时间里它确实隐形过、又现形过
        expect(cloaks, 'it cloaked').toBeGreaterThanOrEqual(2);
        expect(returns, 'it came back').toBeGreaterThanOrEqual(2);
        expect(hiddenFrames).toBeGreaterThan(20);
      }
    );
  });
});
