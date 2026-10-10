import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CameraRig, type CameraMode, type CameraRigFlightState } from '@/features/camera/CameraRig';

/**
 * 竖屏视场补偿（规格 C1）。CameraRig 是唯一写 camera.fov 的地方：
 * - 横屏（aspect ≥ 1）：基础 75° + 原有的速度 / 加力增量，与以前一样；
 * - 竖屏（aspect < 1）：抬高竖直 FOV，让水平视场不低于 70°；竖直 FOV 连同增量封顶 95°。
 *   静止时：aspect 0.75 → 约 86.07°；aspect 9/19.5 → 95°（封顶）。
 * FOV 是平滑过渡的，所以每个用例都先让相机稳定下来再读数。
 */

const DT = 1 / 60;
const BASE_FOV = 75;
const PORTRAIT_CAP = 95;
const MIN_HORIZONTAL_FOV = 70;
const REST: CameraRigFlightState = { speedRatio: 0, boosting: false };
const FLAT_OUT: CameraRigFlightState = { speedRatio: 1, boosting: true };

const LANDSCAPE_ASPECTS = [21 / 9, 16 / 9, 16 / 10, 4 / 3, 1.05, 1];
const PORTRAIT_ASPECTS = [0.99, 0.95, 0.9, 0.8, 0.75, 2 / 3, 10 / 16, 9 / 16, 9 / 19.5, 0.4];
const FLIGHT_STATES: readonly CameraRigFlightState[] = [
  REST,
  { speedRatio: 0.5, boosting: false },
  { speedRatio: 1, boosting: false },
  { speedRatio: 0.3, boosting: true },
  FLAT_OUT,
];
const MODES: readonly CameraMode[] = ['third-person', 'first-person'];

/** 竖直 FOV 与宽高比对应的水平 FOV（度） */
function horizontalFov(verticalFov: number, aspect: number): number {
  return (
    2 *
    THREE.MathUtils.radToDeg(
      Math.atan(aspect * Math.tan(THREE.MathUtils.degToRad(verticalFov / 2)))
    )
  );
}

/** 保住水平 70° 所需的竖直 FOV（度） */
function verticalFovFor(horizontal: number, aspect: number): number {
  return (
    2 *
    THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(horizontal / 2)) / aspect))
  );
}

interface Fixture {
  camera: THREE.PerspectiveCamera;
  target: THREE.Group;
  rig: CameraRig;
}

describe('CameraRig field of view', () => {
  const fixtures: Fixture[] = [];

  beforeAll(() => {
    // 无 canvas 环境：座舱仪表贴图走回退
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    for (const fixture of fixtures.splice(0)) fixture.rig.dispose();
  });

  function create(aspect: number, mode: CameraMode = 'third-person'): Fixture {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(BASE_FOV, aspect, 0.1, 5000);
    const target = new THREE.Group();
    target.add(new THREE.Mesh(new THREE.BoxGeometry(2, 1, 6), new THREE.MeshBasicMaterial()));
    target.position.set(10, 120, -40);
    scene.add(target);
    const fixture = { camera, target, rig: new CameraRig(camera, target, { mode }) };
    fixtures.push(fixture);
    return fixture;
  }

  function fly({ rig, target }: Fixture, state: CameraRigFlightState, seconds: number): void {
    const frames = Math.round(seconds / DT);
    for (let i = 0; i < frames; i++) {
      rig.update(target.position, target.quaternion, DT, state);
    }
  }

  /** 这个宽高比、飞行状态、视角下稳定后的竖直 FOV */
  function settledFov(
    aspect: number,
    state: CameraRigFlightState = REST,
    mode: CameraMode = 'third-person'
  ): number {
    const fixture = create(aspect, mode);
    fly(fixture, state, 8);
    return fixture.camera.fov;
  }

  // ───────────────────────────── 横屏 ─────────────────────────────

  describe('landscape (aspect ≥ 1)', () => {
    it.each(LANDSCAPE_ASPECTS)('rests at the base 75° at aspect %f', (aspect) => {
      expect(settledFov(aspect)).toBeCloseTo(BASE_FOV, 2);
      expect(settledFov(aspect, REST, 'first-person')).toBeCloseTo(BASE_FOV, 2);
    });

    it('keeps the speed / boost kick it had before', () => {
      // 第三人称：速度 +4°（按速度比平方）、加力 +5°；第一人称的增量是 0.85 倍
      expect(settledFov(16 / 9, { speedRatio: 1, boosting: false })).toBeCloseTo(79, 2);
      expect(settledFov(16 / 9, { speedRatio: 0.5, boosting: false })).toBeCloseTo(76, 2);
      expect(settledFov(16 / 9, { speedRatio: 0, boosting: true })).toBeCloseTo(80, 2);
      expect(settledFov(16 / 9, FLAT_OUT)).toBeCloseTo(84, 2);
      expect(settledFov(16 / 9, FLAT_OUT, 'first-person')).toBeCloseTo(75 + 9 * 0.85, 2);
    });

    it('does not depend on how wide the screen is', () => {
      for (const state of FLIGHT_STATES) {
        for (const mode of MODES) {
          const reference = settledFov(16 / 9, state, mode);
          for (const aspect of LANDSCAPE_ASPECTS) {
            expect(settledFov(aspect, state, mode), `aspect ${aspect}`).toBeCloseTo(reference, 3);
          }
        }
      }
    });
  });

  // ───────────────────────────── 竖屏 ─────────────────────────────

  describe('portrait (aspect < 1)', () => {
    it('rests at about 86.07° at aspect 0.75, which is a 70° horizontal view', () => {
      const fov = settledFov(0.75);
      expect(Math.abs(fov - 86.07)).toBeLessThan(0.05);
      expect(horizontalFov(fov, 0.75)).toBeCloseTo(MIN_HORIZONTAL_FOV, 1);
    });

    it('rests at the 95° cap on a tall phone (aspect 9 / 19.5)', () => {
      expect(settledFov(9 / 19.5)).toBeCloseTo(PORTRAIT_CAP, 2);
      expect(settledFov(9 / 19.5, REST, 'first-person')).toBeCloseTo(PORTRAIT_CAP, 2);
    });

    it.each(PORTRAIT_ASPECTS)(
      'at rest, aspect %f gives a horizontal view of at least 70° or sits at the cap',
      (aspect) => {
        for (const mode of MODES) {
          const fov = settledFov(aspect, REST, mode);
          const needed = verticalFovFor(MIN_HORIZONTAL_FOV, aspect);
          // 不低于基础 75°；够得着 70° 水平视场就正好抬到那里，够不着就停在 95°
          expect(fov, mode).toBeCloseTo(Math.min(PORTRAIT_CAP, Math.max(BASE_FOV, needed)), 2);
          if (fov < PORTRAIT_CAP - 0.01) {
            expect(horizontalFov(fov, aspect), mode).toBeGreaterThanOrEqual(
              MIN_HORIZONTAL_FOV - 0.01
            );
          }
        }
      }
    );

    it('never exceeds 95° vertical, kick included', () => {
      for (const aspect of PORTRAIT_ASPECTS) {
        for (const state of FLIGHT_STATES) {
          for (const mode of MODES) {
            const fixture = create(aspect, mode);
            const frames = Math.round(6 / DT);
            for (let i = 0; i < frames; i++) {
              fixture.rig.update(fixture.target.position, fixture.target.quaternion, DT, state);
              expect(
                fixture.camera.fov,
                `aspect ${aspect}, speed ${state.speedRatio}, boost ${state.boosting}, ${mode}`
              ).toBeLessThanOrEqual(PORTRAIT_CAP + 1e-6);
            }
          }
        }
      }
    });

    it('never gives less than landscape does: at least the base plus the kick', () => {
      for (const aspect of PORTRAIT_ASPECTS) {
        for (const state of FLIGHT_STATES) {
          for (const mode of MODES) {
            expect(
              settledFov(aspect, state, mode),
              `aspect ${aspect}, speed ${state.speedRatio}, boost ${state.boosting}, ${mode}`
            ).toBeGreaterThanOrEqual(settledFov(16 / 9, state, mode) - 1e-3);
          }
        }
      }
    });

    it('adds the same speed / boost kick on top, up to the cap', () => {
      for (const aspect of [0.9, 0.8, 0.75, 2 / 3, 9 / 16, 9 / 19.5]) {
        for (const state of FLIGHT_STATES) {
          for (const mode of MODES) {
            const kick = settledFov(16 / 9, state, mode) - BASE_FOV;
            const rest = settledFov(aspect, REST, mode);
            const expected = Math.max(BASE_FOV + kick, Math.min(PORTRAIT_CAP, rest + kick));
            expect(
              settledFov(aspect, state, mode),
              `aspect ${aspect}, speed ${state.speedRatio}, boost ${state.boosting}, ${mode}`
            ).toBeCloseTo(Math.min(PORTRAIT_CAP, expected), 2);
          }
        }
      }
    });

    it('still shows the kick where there is room below the cap', () => {
      // aspect 0.9：静止约 75.76°，全速加力再加 9° → 约 84.76°
      const rest = settledFov(0.9);
      expect(rest).toBeCloseTo(verticalFovFor(MIN_HORIZONTAL_FOV, 0.9), 2);
      expect(settledFov(0.9, FLAT_OUT) - rest).toBeCloseTo(9, 2);
      // aspect 0.75：静止 86.07° + 9° 超过封顶，停在 95°
      expect(settledFov(0.75, FLAT_OUT)).toBeCloseTo(PORTRAIT_CAP, 2);
    });
  });

  // ───────────────────────────── 过渡 ─────────────────────────────

  describe('transitions', () => {
    it('follows the camera aspect when the screen is rotated, smoothly', () => {
      const fixture = create(16 / 9);
      fly(fixture, REST, 3);
      expect(fixture.camera.fov).toBeCloseTo(BASE_FOV, 2);

      // 转成竖屏：GameScene 的 resize 改了 camera.aspect
      fixture.camera.aspect = 0.75;
      fixture.camera.updateProjectionMatrix();
      let previous = fixture.camera.fov;
      fly(fixture, REST, DT);
      expect(fixture.camera.fov, 'no jump on the first frame').toBeLessThan(BASE_FOV + 2);
      expect(fixture.camera.fov).toBeGreaterThan(BASE_FOV);
      for (let i = 0; i < 120; i++) {
        previous = fixture.camera.fov;
        fly(fixture, REST, DT);
        expect(fixture.camera.fov).toBeGreaterThanOrEqual(previous - 1e-9);
        expect(fixture.camera.fov - previous, 'no step larger than a degree').toBeLessThan(1);
      }
      fly(fixture, REST, 6);
      expect(Math.abs(fixture.camera.fov - 86.07)).toBeLessThan(0.05);

      // 转回横屏
      fixture.camera.aspect = 16 / 9;
      fixture.camera.updateProjectionMatrix();
      fly(fixture, REST, DT);
      expect(fixture.camera.fov, 'no jump back either').toBeGreaterThan(86.07 - 2);
      for (let i = 0; i < 120; i++) {
        previous = fixture.camera.fov;
        fly(fixture, REST, DT);
        expect(fixture.camera.fov).toBeLessThanOrEqual(previous + 1e-9);
      }
      fly(fixture, REST, 8);
      expect(fixture.camera.fov).toBeCloseTo(BASE_FOV, 2);
    });

    it('eases the kick in and out in portrait as well', () => {
      const fixture = create(0.9);
      fly(fixture, REST, 4);
      const rest = fixture.camera.fov;
      fly(fixture, FLAT_OUT, DT);
      expect(fixture.camera.fov).toBeGreaterThan(rest);
      expect(fixture.camera.fov).toBeLessThan(rest + 2);
      fly(fixture, FLAT_OUT, 6);
      expect(fixture.camera.fov).toBeCloseTo(rest + 9, 2);
      fly(fixture, REST, 8);
      expect(fixture.camera.fov).toBeCloseTo(rest, 2);
    });

    it('keeps the projection matrix in step with the field of view it wrote', () => {
      for (const aspect of [16 / 9, 0.75, 9 / 19.5]) {
        const fixture = create(aspect);
        fly(fixture, FLAT_OUT, 5);
        const { camera } = fixture;
        const elements = camera.projectionMatrix.elements;
        const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        expect(elements[5], `aspect ${aspect}: vertical scale`).toBeCloseTo(1 / halfTan, 3);
        expect(elements[0], `aspect ${aspect}: horizontal scale`).toBeCloseTo(
          1 / (halfTan * aspect),
          3
        );
      }
    });

    it('stays finite and within range whatever the aspect is', () => {
      for (const aspect of [Number.NaN, 0, -1, Infinity, 1e-6, 1e6]) {
        const fixture = create(1);
        fixture.camera.aspect = aspect;
        fly(fixture, FLAT_OUT, 2);
        expect(Number.isFinite(fixture.camera.fov), `aspect ${aspect}`).toBe(true);
        expect(fixture.camera.fov).toBeGreaterThanOrEqual(BASE_FOV - 1e-6);
        expect(fixture.camera.fov).toBeLessThanOrEqual(PORTRAIT_CAP + 1e-6);
      }
    });

    it('gives the camera its own field of view back on dispose()', () => {
      const fixture = create(0.75);
      fly(fixture, FLAT_OUT, 4);
      expect(fixture.camera.fov).toBeGreaterThan(90);
      fixture.rig.dispose();
      expect(fixture.camera.fov).toBe(BASE_FOV);
    });
  });

  // ───────────────────────────── 唯一写入者 ─────────────────────────────

  describe('single writer', () => {
    const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const RIG_FILE = path.join('features', 'camera', 'CameraRig.ts');
    /** 给 .fov 赋值（=、+=、-= …），不含比较 */
    const FOV_WRITE = /\.fov\s*(?:[-+*/]|\*\*)?=(?!=)/;

    function sourceFiles(directory: string, out: string[] = []): string[] {
      for (const name of readdirSync(directory)) {
        const full = path.join(directory, name);
        if (statSync(full).isFile()) {
          if (/\.tsx?$/.test(name) && !/\.(test|spec|d)\.ts$/.test(name)) out.push(full);
        } else if (name !== '__tests__' && name !== 'node_modules') {
          sourceFiles(full, out);
        }
      }
      return out;
    }

    /** 去掉注释，免得注释里的说明被当成代码 */
    function code(file: string): string {
      return readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
    }

    it('no source file other than CameraRig.ts assigns a .fov', () => {
      const files = sourceFiles(SRC_ROOT);
      expect(files.length, 'the scan found the sources').toBeGreaterThan(100);

      const writers = files
        .filter((file) => FOV_WRITE.test(code(file)))
        .map((file) => file.slice(SRC_ROOT.length + 1));
      expect(writers).toEqual([RIG_FILE]);
    });

    it('CameraRig.ts does write camera.fov (the scan can see a write)', () => {
      expect(code(path.join(SRC_ROOT, RIG_FILE))).toMatch(/camera\.fov\s*=(?!=)/);
    });
  });
});
