import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Faction } from '@/core/Faction';
import type { EnemyAI } from '@/features/enemy/EnemyAI';
import { EnemyType } from '@/features/enemy/EnemyTypes';
import { UNIT_CONFIGS, UNIT_TYPES, UnitType } from '@/features/units/UnitTypes';
import {
  CAMERA_FOV_DEG,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  createCombatHudRig,
  readBar,
  type CombatHudRig,
} from './combatHudRig';

/**
 * 喷气机血条的位置跟着机体大小走（敌机编队规格 §1）。
 *
 * 规格：机体大小是真的——各机型的网格缩放与命中半径（命中半径 = 2.5 × 缩放，缩放 2.0 保持原来的
 * 5 米）：SCOUT 1.5、FIGHTER 2.0、HEAVY 3.0、SNIPER 2.1、ACE 2.2、JAMMER 2.2、STRIKER 2.4、
 * WRAITH 2.0；僚机 2.0。工厂在每架敌机 / 友军机的根节点上写 userData.hitRadius，读它的代码在
 * 缺失时按 5 米算。
 * 血条：参考点在机体中心上方 2 × 命中半径 / 5 米——缩放 2.0 的机体还是原来的 2 米，重型机 3 米，
 * 侦察机 1.5 米；不再是所有机型都 2 米（大块头的血条和名称落在机身里）。
 *
 * 量法：jsdom 不做布局，血条的位置读内联样式。血条的下沿在参考点的投影上方固定若干像素；
 * 相机与目标同高、水平正对着它时，参考点高出画面中心的像素数与距离成反比，所以在两个距离上
 * 各读一次血条的位置，就能把“高出中心多少米”和那段固定的像素分开，不必知道后者是多少。
 * 整条链路是真实的（见 combatHudRig.ts）：敌机来自真实的生成路径，僚机照协调器的做法组装。
 */

const ENEMY_TYPES = Object.values(EnemyType);

/** 规格 §1：各机型的网格缩放 */
const SPEC_SCALE: Readonly<Record<EnemyType, number>> = {
  [EnemyType.SCOUT]: 1.5,
  [EnemyType.FIGHTER]: 2.0,
  [EnemyType.HEAVY]: 3.0,
  [EnemyType.SNIPER]: 2.1,
  [EnemyType.ACE]: 2.2,
  [EnemyType.JAMMER]: 2.2,
  [EnemyType.STRIKER]: 2.4,
  [EnemyType.WRAITH]: 2.0,
};
const WINGMAN_SCALE = 2.0;
/** 规格 §1：命中半径 = 2.5 × 缩放；缺失时按 5 米 */
const hitRadiusOf = (scale: number): number => 2.5 * scale;
const DEFAULT_HIT_RADIUS = 5;
/** 血条参考点离机体中心的高度（米） */
const liftFor = (hitRadius: number): number => (2 * hitRadius) / 5;

/** 量血条用的两个距离（米） */
const NEAR = 60;
const FAR = 180;
/** 画面中心到上沿的像素数 ÷ tan(半视场)：一米高的东西在一米外占的像素 */
const FOCAL_PX = VIEW_HEIGHT / 2 / Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV_DEG / 2));

const HOSTILE_UNIT_TYPES = UNIT_TYPES.filter(
  // 潜艇一开局就潜航（没有标记），不在这里量
  (type) => UNIT_CONFIGS[type].faction === Faction.ENEMY && type !== UnitType.SUBMARINE
);

describe('health bar placement follows the size of the jet', () => {
  let rig: CombatHudRig;
  let slot: number;

  beforeEach(async () => {
    rig = await createCombatHudRig();
    slot = 0;
  });

  afterEach(() => {
    rig.dispose();
  });

  /** 目标彼此隔开 3 公里：正对着一个量的时候，别的都在画面外 */
  function nextPlace(height = 300): THREE.Vector3 {
    return new THREE.Vector3(slot++ * 3000, height, 0);
  }

  const centreOf = (mesh: THREE.Object3D): THREE.Vector3 =>
    mesh.getWorldPosition(new THREE.Vector3());

  /** 与目标同高、在它正南 distance 米处水平正对着它，刷新一次，读它的血条 */
  function barFromLevel(mesh: THREE.Object3D, distance: number): ReturnType<typeof readBar> {
    const centre = centreOf(mesh);
    rig.lookFrom(centre.clone().add(new THREE.Vector3(0, 0, distance)), centre);
    rig.refreshBars();
    const bar = rig.barOf(mesh);
    expect(bar, `a health bar over the target from ${distance} m`).not.toBeNull();
    const drawn = readBar(bar as HTMLElement);
    expect(drawn.centreX, 'the bar is centred on the target').toBeCloseTo(VIEW_WIDTH / 2, 3);
    return drawn;
  }

  /**
   * 血条参考点高出目标中心多少米（metres），以及血条下沿在参考点的投影上方多少像素（gapPx）。
   */
  function measure(mesh: THREE.Object3D): { metres: number; gapPx: number } {
    const near = barFromLevel(mesh, NEAR);
    const far = barFromLevel(mesh, FAR);
    const nearBottom = near.top + near.height;
    const farBottom = far.top + far.height;
    const metres = (farBottom - nearBottom) / (FOCAL_PX * (1 / NEAR - 1 / FAR));
    const gapPx = VIEW_HEIGHT / 2 - (metres * FOCAL_PX) / NEAR - nearBottom;
    return { metres, gapPx };
  }

  // ───────────────────────────── 机体大小（前提） ─────────────────────────────

  describe('the size each jet declares (spec §1)', () => {
    it.each(ENEMY_TYPES)('%s: mesh scale and hit radius = 2.5 × scale', (type) => {
      const mesh = rig.spawnJet(type, nextPlace()).getMesh();
      const scale = SPEC_SCALE[type];
      expect(mesh.scale.toArray(), 'mesh scale').toEqual([scale, scale, scale]);
      expect(mesh.userData.hitRadius, 'userData.hitRadius on the root').toBeCloseTo(
        hitRadiusOf(scale),
        9
      );
    });

    it('wingman: scale 2.0, hit radius 5', () => {
      const mesh = rig.spawnWingman(nextPlace()).getMesh();
      expect(mesh.scale.toArray()).toEqual([WINGMAN_SCALE, WINGMAN_SCALE, WINGMAN_SCALE]);
      expect(mesh.userData.hitRadius).toBeCloseTo(hitRadiusOf(WINGMAN_SCALE), 9);
    });
  });

  // ───────────────────────────── 血条高度 ─────────────────────────────

  describe('how far above the jet the bar sits', () => {
    it.each(ENEMY_TYPES)('%s: 2 × hit radius / 5 metres above its centre', (type) => {
      const jet = rig.spawnJet(type, nextPlace());
      const { metres } = measure(jet.getMesh());
      expect(metres).toBeCloseTo(liftFor(hitRadiusOf(SPEC_SCALE[type])), 3);
    });

    it('wingman: 2 metres, as before', () => {
      const wingman = rig.spawnWingman(nextPlace());
      const { metres } = measure(wingman.getMesh());
      expect(
        rig.fed.friendlies.map((bar) => bar.mesh),
        'fed as a friendly'
      ).toEqual([wingman.getMesh()]);
      expect(metres).toBeCloseTo(liftFor(hitRadiusOf(WINGMAN_SCALE)), 3);
      expect(metres).toBeCloseTo(2, 3);
    });

    it('a scale-2.0 jet keeps the old 2 metres; the Heavy gets 3 and the Scout 1.5', () => {
      const lift = (type: EnemyType): number =>
        measure(rig.spawnJet(type, nextPlace()).getMesh()).metres;
      expect(lift(EnemyType.FIGHTER)).toBeCloseTo(2, 3);
      expect(lift(EnemyType.WRAITH)).toBeCloseTo(2, 3);
      expect(lift(EnemyType.HEAVY)).toBeCloseTo(3, 3);
      expect(lift(EnemyType.SCOUT)).toBeCloseTo(1.5, 3);
    });

    it('keeps the same pixel gap between the bar and that point for every jet', () => {
      const gaps = [
        ...ENEMY_TYPES.map((type) => rig.spawnJet(type, nextPlace()).getMesh()),
        rig.spawnWingman(nextPlace()).getMesh(),
      ].map((mesh) => measure(mesh).gapPx);
      expect(gaps[0]).toBeGreaterThan(0);
      for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 2);
    });

    it('follows the radius the mesh declares, not the type name', () => {
      // 同一种机型，声明的命中半径不同（比如以后调了大小）：血条跟着声明走
      const jet = rig.spawnJet(EnemyType.FIGHTER, nextPlace());
      jet.getMesh().userData.hitRadius = 10;
      expect(measure(jet.getMesh()).metres).toBeCloseTo(4, 3);
    });
  });

  // ───────────────────────────── 没有声明命中半径 ─────────────────────────────

  describe('a jet mesh that declares no hit radius', () => {
    it.each([EnemyType.HEAVY, EnemyType.SCOUT, EnemyType.FIGHTER])(
      '%s without userData.hitRadius is placed as radius 5 (2 metres)',
      (type) => {
        const jet = rig.spawnJet(type, nextPlace());
        delete jet.getMesh().userData.hitRadius;
        expect(measure(jet.getMesh()).metres).toBeCloseTo(liftFor(DEFAULT_HIT_RADIUS), 3);
      }
    );

    it('a wingman mesh without it is placed as radius 5 as well', () => {
      const wingman = rig.spawnWingman(nextPlace());
      delete wingman.getMesh().userData.hitRadius;
      expect(measure(wingman.getMesh()).metres).toBeCloseTo(liftFor(DEFAULT_HIT_RADIUS), 3);
    });

    // 项目约定：位置要防 NaN / Infinity。声明了一个用不了的半径时按“没有声明”处理，血条照样画
    it.each([
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
      ['zero', 0],
      ['a negative number', -4],
      ['a string', '7.5'],
    ])('a hit radius that is %s counts as missing', (_name, value) => {
      const jet = rig.spawnJet(EnemyType.HEAVY, nextPlace());
      jet.getMesh().userData.hitRadius = value;
      const { metres } = measure(jet.getMesh());
      expect(Number.isFinite(metres)).toBe(true);
      expect(metres).toBeCloseTo(liftFor(DEFAULT_HIT_RADIUS), 3);
    });
  });

  // ───────────────────────────── “上方”是世界的上方 ─────────────────────────────

  describe('above means up in the world', () => {
    /** 从斜上 / 斜下看：血条的下沿在“中心上方 metres 米”那一点的投影上方 gapPx 像素 */
    function expectBarAt(mesh: THREE.Object3D, metres: number, gapPx: number): void {
      const centre = centreOf(mesh);
      for (const [name, from] of [
        ['from above', new THREE.Vector3(0, 70, 110)],
        ['from below', new THREE.Vector3(0, -55, 95)],
      ] as const) {
        rig.lookFrom(centre.clone().add(from), centre);
        rig.refreshBars();
        const bar = rig.barOf(mesh);
        expect(bar, `a health bar, seen ${name}`).not.toBeNull();
        const drawn = readBar(bar as HTMLElement);
        const point = rig.screenPoint(centre.clone().add(new THREE.Vector3(0, metres, 0)));
        expect(drawn.centreX, `${name}: centred`).toBeCloseTo(point.x, 2);
        expect(drawn.top + drawn.height, `${name}: bottom edge`).toBeCloseTo(point.y - gapPx, 2);
      }
    }

    it('whatever the angle the jet is seen from', () => {
      const heavy = rig.spawnJet(EnemyType.HEAVY, nextPlace()).getMesh();
      const { metres, gapPx } = measure(heavy);
      expectBarAt(heavy, metres, gapPx);
    });

    it('and however the jet is rolled or pitched', () => {
      const level = rig.spawnJet(EnemyType.HEAVY, nextPlace()).getMesh();
      const banked = rig.spawnJet(EnemyType.HEAVY, nextPlace()).getMesh();
      const inverted = rig.spawnJet(EnemyType.HEAVY, nextPlace()).getMesh();
      banked.rotation.set(THREE.MathUtils.degToRad(-35), 0.6, THREE.MathUtils.degToRad(80));
      inverted.rotation.set(0, 0, Math.PI);
      banked.updateMatrixWorld(true);
      inverted.updateMatrixWorld(true);

      const reference = measure(level);
      for (const mesh of [banked, inverted]) {
        const measured = measure(mesh);
        expect(measured.metres).toBeCloseTo(reference.metres, 3);
        expect(measured.gapPx).toBeCloseTo(reference.gapPx, 2);
        expectBarAt(mesh, reference.metres, reference.gapPx);
      }
    });
  });

  // ───────────────────────────── 单位不跟着变 ─────────────────────────────

  describe('ground, sea and air units are placed as before', () => {
    it.each(HOSTILE_UNIT_TYPES)('%s: 2 metres above it, whatever its hit radius', (type) => {
      const air = UNIT_CONFIGS[type].domain === 'air';
      const unit = rig.spawnUnit(type, nextPlace(air ? 500 : 0));
      expect(unit.mesh.userData.hitRadius, 'the unit declares its own hit radius').toBe(
        UNIT_CONFIGS[type].hitRadius
      );
      const { metres } = measure(unit.mesh);
      expect(metres).toBeCloseTo(2, 3);
    });

    it('covers units whose hit radius is nothing like 5 metres', () => {
      const radii = HOSTILE_UNIT_TYPES.map((type) => UNIT_CONFIGS[type].hitRadius);
      expect(Math.max(...radii)).toBeGreaterThan(20);
      expect(radii.filter((radius) => radius !== DEFAULT_HIT_RADIUS).length).toBeGreaterThan(5);
    });
  });

  it('places every jet in one frame, each by its own size', () => {
    // 九架并排在玩家正前方，一帧里各有各的血条
    const spacing = 60;
    const jets: Array<[name: string, mesh: THREE.Object3D, scale: number]> = ENEMY_TYPES.map(
      (type, index) => {
        const jet: EnemyAI = rig.spawnJet(
          type,
          new THREE.Vector3((index - 4) * spacing, 300, -400)
        );
        return [type, jet.getMesh(), SPEC_SCALE[type]];
      }
    );
    const wingman = rig.spawnWingman(new THREE.Vector3(4 * spacing, 300, -400));
    jets.push(['wingman', wingman.getMesh(), WINGMAN_SCALE]);

    // 先量出血条下沿与参考点之间那段固定的像素
    const { gapPx } = measure(jets[1][1]);

    rig.lookFrom(new THREE.Vector3(0, 300, 0), new THREE.Vector3(0, 300, -400));
    rig.refreshBars();
    expect(rig.shownBars()).toHaveLength(jets.length);
    for (const [name, mesh, scale] of jets) {
      const bar = rig.barOf(mesh);
      expect(bar, `${name} has a health bar`).not.toBeNull();
      const drawn = readBar(bar as HTMLElement);
      const point = rig.screenPoint(
        centreOf(mesh).add(new THREE.Vector3(0, liftFor(hitRadiusOf(scale)), 0))
      );
      expect(drawn.centreX, `${name}: centred`).toBeCloseTo(point.x, 2);
      expect(drawn.top + drawn.height, `${name}: height`).toBeCloseTo(point.y - gapPx, 2);
    }
  });
});
