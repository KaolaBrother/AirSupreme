import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameConfig } from '@/config';
import { RadarMinimap, type RadarBlip, type RadarBlipKind } from '@/ui/RadarMinimap';
import {
  addedShapes,
  boundsOf,
  centreOf,
  copyShapes,
  extentOf,
  installCanvasRecording,
  isLineSegment,
  type CanvasRecorder,
  type CanvasRecording,
  type PaintedShape,
  type Point,
} from './canvasRecorder';

/**
 * 雷达小地图的朝向与盘边（规格 M5 / M6）：
 * - 航向朝上：正前方的目标画在盘心上方，后方在下方，玩家右手边的目标画在盘心右侧——
 *   对每个航向都成立（玩家朝 -Z 时右手边是 +X）。改动前左右是反的。
 * - 量程外的目标不再画成“贴在盘边的量程内目标”：改成更小的空心符号加一截朝外的短线，
 *   略收在盘边以内，方向正确；量程内的目标照旧是实心符号。
 *
 * 画布用记录型上下文：先画一帧空盘，再画一帧只多一个目标的盘，两帧之差就是这个目标的符号。
 */

const PLAYER = new THREE.Vector3(220, 150, -340);
const IN_RANGE_M = 150;
const BEYOND_RANGE_M = 5000;
const ALL_KINDS: readonly RadarBlipKind[] = [
  'enemy',
  'spawning',
  'boss',
  'enemy-ground',
  'enemy-sea',
  'ally',
  'ally-unit',
  'neutral',
  'pickup',
];

/** 航向（度，从正北 -Z 顺时针转向正东 +X）→ 机体姿态 */
function heading(deg: number, pitchDeg = 0): THREE.Quaternion {
  const yaw = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    -THREE.MathUtils.degToRad(deg)
  );
  const pitch = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    THREE.MathUtils.degToRad(pitchDeg)
  );
  return yaw.multiply(pitch);
}

const HEADINGS: ReadonlyArray<readonly [name: string, deg: number]> = [
  ['north (-Z)', 0],
  ['east (+X)', 90],
  ['south (+Z)', 180],
  ['west (-X)', 270],
  ['north-east (diagonal)', 45],
  ['south-west (diagonal)', 225],
];

/**
 * 玩家水平面上的前 / 右方向：机头 (0,0,-1)、右翼 (1,0,0) 随姿态转动后压到水平面
 * （规格：朝 -Z 时右手边是 +X）。
 */
function horizontalAxes(rotation: THREE.Quaternion): {
  forward: THREE.Vector3;
  right: THREE.Vector3;
} {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(rotation).setY(0).normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(rotation).setY(0).normalize();
  return { forward, right };
}

/** 相对方位（度，0 = 正前，90 = 正右）、距离 → 世界坐标 */
function contactAt(
  rotation: THREE.Quaternion,
  bearingDeg: number,
  distance: number,
  altitude = 40
): THREE.Vector3 {
  const { forward, right } = horizontalAxes(rotation);
  const bearing = THREE.MathUtils.degToRad(bearingDeg);
  return PLAYER.clone()
    .addScaledVector(forward, Math.cos(bearing) * distance)
    .addScaledVector(right, Math.sin(bearing) * distance)
    .setY(altitude);
}

type DrawFn = (rotation: THREE.Quaternion, contacts: RadarBlip[]) => void;

describe('RadarMinimap handedness and rim', () => {
  let recording: CanvasRecording;
  let radar: RadarMinimap;
  let recorder: CanvasRecorder;
  let centre: Point;
  let discRadius: number;
  let originalIsMobile: boolean;
  let originalMaxTouchPoints: number;

  beforeEach(() => {
    originalIsMobile = GameConfig.isMobile;
    originalMaxTouchPoints = navigator.maxTouchPoints;
    GameConfig.isMobile = false;
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    window.ontouchstart = null;
    document.body.innerHTML = '';
    recording = installCanvasRecording();
    radar = new RadarMinimap();
    const canvas = document.querySelector<HTMLCanvasElement>('#radar-minimap canvas');
    expect(canvas, 'the radar draws on a canvas inside #radar-minimap').toBeTruthy();
    const found = recording.of(canvas);
    expect(found, 'the radar asked for a 2D context').toBeTruthy();
    recorder = found as CanvasRecorder;
    const size = (canvas as HTMLCanvasElement).width;
    expect(size).toBeGreaterThan(0);
    centre = { x: size / 2, y: size / 2 };
    discRadius = size / 2;
  });

  afterEach(() => {
    radar.dispose();
    recording.restore();
    GameConfig.isMobile = originalIsMobile;
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      value: originalMaxTouchPoints,
    });
    document.body.innerHTML = '';
  });

  const viaBlips: DrawFn = (rotation, contacts) => radar.updateBlips(PLAYER, contacts, rotation);
  /** 旧入口 update(敌机, 气球, 朝向, 友军)：同样的投影 */
  const viaLegacyUpdate: DrawFn = (rotation, contacts) =>
    radar.update(
      PLAYER,
      contacts.map((contact) => ({ position: contact.position, isSpawning: false })),
      [],
      rotation
    );

  /** 多画这一个目标时新出现的形状 */
  function glyphOf(
    rotation: THREE.Quaternion,
    contact: RadarBlip,
    draw: DrawFn = viaBlips
  ): PaintedShape[] {
    recorder.clear();
    draw(rotation, []);
    const empty = copyShapes(recorder.shapes);
    recorder.clear();
    draw(rotation, [contact]);
    const added = addedShapes(empty, recorder.shapes);
    expect(added.length, `a ${contact.kind} contact draws something`).toBeGreaterThan(0);
    return added;
  }

  function offsetOf(
    rotation: THREE.Quaternion,
    bearingDeg: number,
    distance: number,
    draw: DrawFn = viaBlips,
    kind: RadarBlipKind = 'enemy'
  ): Point {
    const glyph = glyphOf(
      rotation,
      { position: contactAt(rotation, bearingDeg, distance), kind },
      draw
    );
    const at = centreOf(glyph.filter((shape) => !isLineSegment(shape)));
    return { x: at.x - centre.x, y: at.y - centre.y };
  }

  describe.each([
    ['updateBlips', viaBlips],
    ['update (legacy entry)', viaLegacyUpdate],
  ] as const)('heading-up projection through %s', (_entry, draw) => {
    describe.each(HEADINGS)('heading %s', (_name, deg) => {
      const rotation = heading(deg);

      it('draws a contact straight ahead above the centre', () => {
        const at = offsetOf(rotation, 0, IN_RANGE_M, draw);
        expect(at.y).toBeLessThan(-5);
        expect(Math.abs(at.x)).toBeLessThan(1.5);
      });

      it('draws a contact behind below the centre', () => {
        const at = offsetOf(rotation, 180, IN_RANGE_M, draw);
        expect(at.y).toBeGreaterThan(5);
        expect(Math.abs(at.x)).toBeLessThan(1.5);
      });

      it("draws a contact on the player's right to the RIGHT of the centre", () => {
        const at = offsetOf(rotation, 90, IN_RANGE_M, draw);
        expect(at.x, 'right of centre').toBeGreaterThan(5);
        expect(Math.abs(at.y)).toBeLessThan(1.5);
      });

      it("draws a contact on the player's left to the LEFT of the centre", () => {
        const at = offsetOf(rotation, -90, IN_RANGE_M, draw);
        expect(at.x, 'left of centre').toBeLessThan(-5);
        expect(Math.abs(at.y)).toBeLessThan(1.5);
      });

      it('draws a contact ahead and to the right in the upper-right quadrant', () => {
        const at = offsetOf(rotation, 45, IN_RANGE_M, draw);
        expect(at.x).toBeGreaterThan(3);
        expect(at.y).toBeLessThan(-3);
        expect(Math.abs(at.x + at.y), 'on the 45° diagonal').toBeLessThan(1.5);
      });
    });
  });

  it('with the player facing -Z, a contact at +X is on the right and one at -X on the left', () => {
    const facingNorth = new THREE.Quaternion();
    const east = glyphOf(facingNorth, {
      position: PLAYER.clone().add(new THREE.Vector3(IN_RANGE_M, 0, 0)),
      kind: 'enemy',
    });
    const west = glyphOf(facingNorth, {
      position: PLAYER.clone().add(new THREE.Vector3(-IN_RANGE_M, 0, 0)),
      kind: 'enemy',
    });
    expect(centreOf(east).x).toBeGreaterThan(centre.x + 5);
    expect(centreOf(west).x).toBeLessThan(centre.x - 5);
  });

  it('uses the horizontal heading: a steep climb does not change left and right', () => {
    const climbingEast = heading(90, 60);
    const right = offsetOf(climbingEast, 90, IN_RANGE_M);
    const ahead = offsetOf(climbingEast, 0, IN_RANGE_M);
    expect(right.x).toBeGreaterThan(5);
    expect(Math.abs(right.y)).toBeLessThan(1.5);
    expect(ahead.y).toBeLessThan(-5);
    expect(Math.abs(ahead.x)).toBeLessThan(1.5);
  });

  it('keeps in-range contacts to scale: twice as far draws twice as far from the centre', () => {
    const rotation = heading(45);
    const near = offsetOf(rotation, 90, 75);
    const far = offsetOf(rotation, 90, 150);
    expect(near.x).toBeGreaterThan(2);
    expect(far.x / near.x).toBeCloseTo(2, 1);
  });

  describe('contacts beyond radar range', () => {
    function parts(glyph: PaintedShape[]): { body: PaintedShape[]; ticks: PaintedShape[] } {
      return {
        body: glyph.filter((shape) => !isLineSegment(shape)),
        ticks: glyph.filter(isLineSegment),
      };
    }

    function glyphAt(
      kind: RadarBlipKind,
      bearingDeg: number,
      distance: number,
      rotation = heading(0)
    ): PaintedShape[] {
      return glyphOf(rotation, { position: contactAt(rotation, bearingDeg, distance), kind });
    }

    /** 与位置无关的“画法”：每个形状是实心还是空心、有几段、多大 */
    function styleOf(glyph: PaintedShape[]): string {
      return JSON.stringify(
        glyph
          .map((shape) => [
            shape.paint,
            shape.subpaths.map((sub) => [sub.points.length, sub.arcs.map((a) => a.r.toFixed(2))]),
            extentOf([shape]).toFixed(1),
          ])
          .sort()
      );
    }

    it.each(ALL_KINDS)('draws an in-range %s the same way wherever it is', (kind) => {
      // 画法只取决于量程内 / 外，而不是方位：对照组
      expect(styleOf(glyphAt(kind, 30, IN_RANGE_M))).toBe(styleOf(glyphAt(kind, 200, 60)));
    });

    it.each(ALL_KINDS)('draws a far %s differently from an in-range one', (kind) => {
      expect(styleOf(glyphAt(kind, 30, BEYOND_RANGE_M))).not.toBe(
        styleOf(glyphAt(kind, 30, IN_RANGE_M))
      );
    });

    it.each(ALL_KINDS)('draws a far %s hollow: nothing is filled', (kind) => {
      const glyph = glyphAt(kind, 30, BEYOND_RANGE_M);
      expect(glyph.filter((shape) => shape.paint === 'fill')).toHaveLength(0);
      expect(glyph.some((shape) => shape.paint === 'stroke')).toBe(true);
    });

    it.each(ALL_KINDS)('draws a far %s smaller than an in-range one', (kind) => {
      const far = parts(glyphAt(kind, 30, BEYOND_RANGE_M)).body;
      const near = parts(glyphAt(kind, 30, IN_RANGE_M)).body;
      expect(far.length).toBeGreaterThan(0);
      expect(extentOf(far)).toBeLessThan(extentOf(near));
    });

    it.each(ALL_KINDS)('adds a tick pointing outward to a far %s, and none in range', (kind) => {
      expect(parts(glyphAt(kind, 30, IN_RANGE_M)).ticks, 'in range: no tick').toHaveLength(0);

      for (const bearing of [0, 90, 180, 270, 30, 225]) {
        const { body, ticks } = parts(glyphAt(kind, bearing, BEYOND_RANGE_M));
        expect(ticks, `bearing ${bearing}`).toHaveLength(1);
        const marker = centreOf(body);
        const outward = new THREE.Vector2(marker.x - centre.x, marker.y - centre.y).normalize();
        const [from, to] = ticks[0].subpaths[0].points;
        const tick = new THREE.Vector2(to.x - from.x, to.y - from.y);
        expect(tick.length(), 'a visible tick').toBeGreaterThan(1.5);
        expect(tick.clone().normalize().dot(outward), `bearing ${bearing}: radial`).toBeGreaterThan(
          0.97
        );
        // 短线在符号外侧：起点比符号中心离盘心更远
        expect(Math.hypot(from.x - centre.x, from.y - centre.y)).toBeGreaterThan(
          Math.hypot(marker.x - centre.x, marker.y - centre.y)
        );
      }
    });

    it.each([
      ['ahead', 0],
      ['right', 90],
      ['behind', 180],
      ['left', 270],
      ['ahead-right', 45],
      ['behind-left', 225],
    ] as const)('puts a far contact %s on the rim in that direction', (_name, bearing) => {
      for (const [, deg] of HEADINGS) {
        const rotation = heading(deg);
        const { body } = parts(glyphAt('enemy', bearing, BEYOND_RANGE_M, rotation));
        const marker = centreOf(body);
        const dx = marker.x - centre.x;
        const dy = marker.y - centre.y;
        // 屏幕方位：0° 向上，顺时针
        const drawn = THREE.MathUtils.radToDeg(Math.atan2(dx, -dy));
        const error = ((drawn - bearing + 540) % 360) - 180;
        expect(Math.abs(error), `heading ${deg}`).toBeLessThan(3);
      }
    });

    it.each(ALL_KINDS)('keeps a far %s slightly inside the rim, tick included', (kind) => {
      for (const bearing of [0, 45, 90, 135, 180, 225, 270, 315]) {
        const glyph = glyphAt(kind, bearing, BEYOND_RANGE_M);
        const marker = centreOf(parts(glyph).body);
        const radius = Math.hypot(marker.x - centre.x, marker.y - centre.y);
        expect(radius, 'near the rim').toBeGreaterThan(discRadius - 16);
        expect(radius, 'inside the rim').toBeLessThan(discRadius);

        const box = boundsOf(glyph);
        const corners: Point[] = [
          { x: box.minX, y: box.minY },
          { x: box.maxX, y: box.minY },
          { x: box.minX, y: box.maxY },
          { x: box.maxX, y: box.maxY },
        ];
        for (const corner of corners) {
          // 外接框的角略大于符号本身：留 1.5px 余量
          expect(
            Math.hypot(corner.x - centre.x, corner.y - centre.y),
            `bearing ${bearing}`
          ).toBeLessThan(discRadius + 1.5);
        }
      }
    });

    it('does not move a far contact as it gets even farther away', () => {
      const near = centreOf(parts(glyphAt('enemy-ground', 70, BEYOND_RANGE_M)).body);
      const far = centreOf(parts(glyphAt('enemy-ground', 70, BEYOND_RANGE_M * 3)).body);
      expect(far.x).toBeCloseTo(near.x, 1);
      expect(far.y).toBeCloseTo(near.y, 1);
    });

    it('draws in-range contacts as filled symbols at their own position', () => {
      for (const kind of ALL_KINDS.filter((k) => k !== 'neutral')) {
        const glyph = glyphAt(kind, 90, IN_RANGE_M);
        expect(
          glyph.some((shape) => shape.paint === 'fill'),
          `${kind} is filled`
        ).toBe(true);
        const at = centreOf(glyph);
        expect(Math.hypot(at.x - centre.x, at.y - centre.y), kind).toBeLessThan(discRadius - 16);
      }
    });
  });
});
