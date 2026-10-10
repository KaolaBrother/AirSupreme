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

  /*
   * 游戏相机（scenes/GameScene.ts 创建、CameraRig 驱动的那一台）的 FOV 只有 CameraRig.ts 写。
   * 静态扫描分不出一句 `.fov = …` 写的是哪一台相机，所以规则是：
   *   1. src 下任何文件写 FOV（赋值、复合赋值、自增自减、['fov']、setFocalLength）都算写入者；
   *   2. 写入者只能是 CameraRig.ts，或 OWN_CAMERA_FILES 里逐个列出的“自带相机”的文件；
   *   3. 列在里面的文件要一直满足“相机是它自己造的、外面递不进别的相机”（ownCameraProblems），
   *      否则豁免作废。
   * 其他地方（包括 src/ui/ 下别的文件）新出现的写入者照样会被报出来。
   */
  describe('single writer', () => {
    const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    /** 相对 src 的路径，统一用正斜杠 */
    const RIG_FILE = 'features/camera/CameraRig.ts';

    /**
     * 写自己那台相机的 FOV、而且游戏相机到不了它手里的文件。
     *
     * - ui/menu/MenuHeroScene.ts：标题画面的实时 3D 主机。相机是它的私有只读字段，就地
     *   `new THREE.PerspectiveCamera(...)`，配它自己的场景和渲染器；构造参数只有挂载点、像素比、
     *   减少动态、上下文丢失回调，没有相机；只导入 three、机体网格工厂和菜单自己的清理工具。
     *   进入战场的推镜动画加宽的是这台相机，游戏从来不用它渲染。
     *
     * 机库的 ui/ModelPreview.ts 同样自带相机，但它现在不写 FOV，所以不列在这里、照常受这条规则
     * 约束：哪天它要写，这条用例会失败，届时按同样的条件核实后再加。
     */
    const OWN_CAMERA_FILES: readonly string[] = ['ui/menu/MenuHeroScene.ts'];

    /** 写 FOV 的各种写法（不含比较与读取） */
    const FOV_WRITE =
      /(?:\.fov|\[\s*['"`]fov['"`]\s*\])\s*(?:(?:[-+*/%]|\*\*)?=(?!=)|\+\+|--)|(?:\+\+|--)\s*[\w.$]+\.fov\b|\.setFocalLength\s*\(/g;

    const fovWrites = (source: string): string[] => source.match(FOV_WRITE) ?? [];

    /** 去掉注释，免得注释里的说明被当成代码 */
    function stripComments(source: string): string {
      return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
    }

    /**
     * 一个文件凭什么算“自带相机”：返回不满足的条件（空数组 = 满足）。
     * 这些条件合起来保证：文件里写的 FOV 只能是它自己就地造的那台相机的。
     */
    function ownCameraProblems(source: string): string[] {
      const fields = [
        ...source.matchAll(
          /private\s+readonly\s+(\w+)\s*=\s*new\s+(?:THREE\.)?PerspectiveCamera\s*\(/g
        ),
      ];
      if (fields.length !== 1) {
        return [`expected one private readonly camera built in place, found ${fields.length}`];
      }
      const field = fields[0][1];
      const problems: string[] = [];

      // 除了那一次构造，不出现任何相机类型：没有相机类型的参数 / 选项 / 字段，也不另造相机
      const cameraTypes = source.match(/\b(?:THREE\.)?(?:[A-Z]\w*)?Camera\b/g) ?? [];
      if (cameraTypes.length !== 1) {
        problems.push(`mentions camera types besides its own camera: ${cameraTypes.join(', ')}`);
      }
      // 这个名字只出现在字段声明和 this.<字段> 里：没有同名的参数、解构或 options.<字段>
      const uses = source.match(new RegExp(`\\b${field}\\b`, 'g'))?.length ?? 0;
      const ownUses = source.match(new RegExp(`\\bthis\\.${field}\\b`, 'g'))?.length ?? 0;
      if (uses !== ownUses + 1) {
        problems.push(
          `"${field}" is used ${uses - ownUses - 1} time(s) other than as this.${field}`
        );
      }
      if (new RegExp(`\\bthis\\.${field}\\s*=(?!=)`).test(source)) {
        problems.push(`this.${field} is reassigned`);
      }
      // 每一处 FOV 写入都写在 this.<字段> 上
      const ownWrites =
        source.match(
          new RegExp(`\\bthis\\.${field}\\.fov\\s*(?:(?:[-+*/%]|\\*\\*)?=(?!=)|\\+\\+|--)`, 'g')
        )?.length ?? 0;
      const writes = fovWrites(source);
      if (ownWrites !== writes.length) {
        problems.push(`writes a FOV that is not this.${field}.fov: ${writes.join(' | ')}`);
      }
      // 不导入游戏运行时（协调器、场景、相机系统）：from '…'、import '…'、import('…')、require('…')
      const runtime = [
        ...source.matchAll(/(?:\bfrom\s+|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g),
      ]
        .map((match) => match[1])
        .filter((from) =>
          /(^|\/)(?:core|scenes)\/|features\/camera|(^|\/)Game(\.\w+)?$/.test(from)
        );
      if (runtime.length > 0) {
        problems.push(`imports game runtime modules: ${runtime.join(', ')}`);
      }
      return problems;
    }

    /** 不该写 FOV 却写了的文件；sources 是 [相对 src 的路径, 去掉注释的源码] */
    function unexpectedWriters(sources: ReadonlyArray<readonly [string, string]>): string[] {
      return sources
        .filter(([, source]) => fovWrites(source).length > 0)
        .filter(
          ([file, source]) =>
            file !== RIG_FILE &&
            !(OWN_CAMERA_FILES.includes(file) && ownCameraProblems(source).length === 0)
        )
        .map(([file]) => file);
    }

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

    function readSource(file: string): string {
      return stripComments(readFileSync(path.join(SRC_ROOT, file), 'utf8'));
    }

    function shippedSources(): Array<[string, string]> {
      return sourceFiles(SRC_ROOT).map((full) => {
        const file = full
          .slice(SRC_ROOT.length + 1)
          .split(path.sep)
          .join('/');
        return [file, readSource(file)];
      });
    }

    /** 一个真正自带相机的文件长什么样（合成的例子） */
    const OWN_CAMERA_SOURCE = `
      import * as THREE from 'three';
      export class Preview {
        private readonly camera = new THREE.PerspectiveCamera(40, 1, 0.5, 400);
        public zoom(amount: number): void {
          this.camera.fov = 40 + amount;
          this.camera.updateProjectionMatrix();
        }
      }
    `;
    const ZOOM_METHOD = 'public zoom(amount: number): void {';

    it('nothing but CameraRig.ts writes a FOV, apart from files that own their camera', () => {
      const sources = shippedSources();
      expect(sources.length, 'the scan found the sources').toBeGreaterThan(100);
      expect(unexpectedWriters(sources)).toEqual([]);

      const writers = sources
        .filter(([, source]) => fovWrites(source).length > 0)
        .map(([file]) => file)
        .sort();
      expect(writers).toEqual([RIG_FILE, ...OWN_CAMERA_FILES].sort());
    });

    it('CameraRig.ts does write camera.fov (the scan can see a write)', () => {
      expect(readSource(RIG_FILE)).toMatch(/camera\.fov\s*=(?!=)/);
      expect(fovWrites(readSource(RIG_FILE)).length).toBeGreaterThan(0);
    });

    it.each(OWN_CAMERA_FILES)('%s builds its own camera and cannot be handed another', (file) => {
      const source = readSource(file);
      // 不再写 FOV 的话就该把它从名单里拿掉
      expect(fovWrites(source).length, 'still writes a FOV').toBeGreaterThan(0);
      expect(ownCameraProblems(source)).toEqual([]);
    });

    it('the hangar preview stays guarded: it has its own camera but writes no FOV', () => {
      const source = readSource('ui/ModelPreview.ts');
      expect(source).toMatch(/new\s+(?:THREE\.)?PerspectiveCamera\s*\(/);
      expect(fovWrites(source)).toEqual([]);
      expect(OWN_CAMERA_FILES).not.toContain('ui/ModelPreview.ts');
    });

    it('recognises every way of writing a FOV, and nothing else', () => {
      const writes = [
        'camera.fov = 75;',
        'this.camera.fov=fov;',
        'rig.camera.fov += 2;',
        'cam.fov -= kick;',
        'cam.fov *= 1.1;',
        'cam.fov /= 2;',
        'cam.fov **= 2;',
        'cam.fov++;',
        '--cam.fov;',
        "camera['fov'] = 60;",
        'camera["fov"] += 1;',
        'camera.setFocalLength(35);',
      ];
      for (const line of writes) {
        expect(fovWrites(line), line).toHaveLength(1);
      }
      const reads = [
        'if (camera.fov === 75) return;',
        'if (camera.fov == other) return;',
        'if (camera.fov !== previous) return;',
        'if (camera.fov >= 90 || camera.fov <= 60) return;',
        'const fov = camera.fov;',
        'const half = Math.tan(camera.fov / 2);',
        'const options = { fov: 75 };',
        'const fovNow = base + kick;',
        'camera.getFocalLength();',
      ];
      for (const line of reads) {
        expect(fovWrites(line), line).toEqual([]);
      }
      // 注释里的说明不算
      const commented =
        '// camera.fov = 75\n/* camera.fov = 80 */\nconst a = 1; // camera.fov = 85';
      expect(fovWrites(stripComments(commented))).toEqual([]);
    });

    it('reports a new writer anywhere else, also under src/ui/', () => {
      const write = 'export function zoom(camera: { fov: number }): void { camera.fov = 60; }';
      for (const file of [
        'scenes/GameScene.ts',
        'core/GameCoordinator.ts',
        'features/weapons/Scope.ts',
        'ui/StartMenu.ts',
        'ui/ModelPreview.ts',
        'ui/menu/TitleScreen.ts',
        'ui/menu/MenuHero.ts',
      ]) {
        expect(unexpectedWriters([[file, write]]), file).toEqual([file]);
        // 就算写法和“自带相机”的文件一模一样，没列在名单里也照报
        expect(unexpectedWriters([[file, OWN_CAMERA_SOURCE]]), file).toEqual([file]);
      }
      expect(unexpectedWriters([[RIG_FILE, write]])).toEqual([]);
      expect(unexpectedWriters([['ui/Labels.ts', 'export const fov = 75;']])).toEqual([]);
    });

    it('honours an own-camera exemption only while the file really owns its camera', () => {
      const [exempt] = OWN_CAMERA_FILES;
      expect(ownCameraProblems(OWN_CAMERA_SOURCE)).toEqual([]);
      expect(unexpectedWriters([[exempt, OWN_CAMERA_SOURCE]])).toEqual([]);

      const handedACamera: Array<[what: string, source: string]> = [
        [
          'the camera comes in through the constructor',
          `import * as THREE from 'three';
           export class Preview {
             constructor(private readonly camera: THREE.PerspectiveCamera) {}
             public zoom(): void { this.camera.fov = 60; }
           }`,
        ],
        [
          'the camera can be replaced from outside',
          `import * as THREE from 'three';
           export class Preview {
             private camera = new THREE.PerspectiveCamera(40, 1, 0.5, 400);
             public setCamera(camera: THREE.PerspectiveCamera): void { this.camera = camera; }
             public zoom(): void { this.camera.fov = 60; }
           }`,
        ],
        [
          'a second camera is passed in next to its own',
          OWN_CAMERA_SOURCE.replace(
            ZOOM_METHOD,
            `public widen(other: THREE.PerspectiveCamera): void { other.fov = 60; }\n${ZOOM_METHOD}`
          ),
        ],
        [
          'a camera arrives untyped through options',
          OWN_CAMERA_SOURCE.replace(
            ZOOM_METHOD,
            `public adopt(options: { camera: { fov: number } }): void { options.camera.fov = 60; }\n${ZOOM_METHOD}`
          ),
        ],
        [
          'it writes the FOV of something that is not its camera',
          OWN_CAMERA_SOURCE.replace('this.camera.fov = 40 + amount;', 'view.fov = 40 + amount;'),
        ],
        [
          'it imports the game scene',
          OWN_CAMERA_SOURCE.replace(
            "import * as THREE from 'three';",
            "import * as THREE from 'three';\nimport { GameScene } from '@/scenes/GameScene';"
          ),
        ],
        [
          'it imports the coordinator for its side effects',
          OWN_CAMERA_SOURCE.replace(
            "import * as THREE from 'three';",
            "import * as THREE from 'three';\nimport '@/core/GameCoordinator';"
          ),
        ],
        [
          'it loads the camera system on demand',
          OWN_CAMERA_SOURCE.replace(
            ZOOM_METHOD,
            `public async rig(): Promise<unknown> { return import('@/features/camera/CameraRig'); }\n${ZOOM_METHOD}`
          ),
        ],
      ];
      for (const [what, source] of handedACamera) {
        expect(source, what).not.toBe(OWN_CAMERA_SOURCE);
        expect(ownCameraProblems(source).length, what).toBeGreaterThan(0);
        expect(unexpectedWriters([[exempt, source]]), what).toEqual([exempt]);
      }
    });
  });
});
