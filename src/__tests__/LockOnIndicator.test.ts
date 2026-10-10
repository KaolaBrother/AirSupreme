import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GAME_CONSTANTS, GameConfig } from '@/config';
import { LockOnIndicator } from '@/ui/LockOnIndicator';
import { setLocale } from '@/i18n';
import { resetLocale } from './i18nTestUtils';

/**
 * 瞄准与锁定显示（W1 准星、W2 捕获环尺寸与常开导引头、W5 反馈）。
 *
 * - 准星（机炮十字）：机头轴线前方 600 米那一点经当前相机投到屏幕上的位置。
 *   触屏机炮辅助会把十字拉到辅助方向上（C4），见文件末尾的 “gun cross with aim assist”；
 *   辅助方向本身怎么算在 GunAimAssist.test.ts。
 * - 捕获环 / 保持环 / 导引头的参考点始终在真实的机头轴线上：环的位置对照机头轴线的投影断言，
 *   不对照十字元素。
 * - 期望的屏幕坐标用三角函数或 THREE 的 Vector3.project 独立算出，不经过被测代码的投影函数。
 */

type LayoutDensity = 'desktop' | 'touch-landscape' | 'touch-portrait';

const DT = 1 / 60;
const AIM_DISTANCE = 600;
const KEEP_RATIO = 1.6;
const GRACE_TIME = 0.5;
/** 座舱眼点（机体局部坐标），与 CameraRig 的第一人称眼点一致 */
const EYE_OFFSET = new THREE.Vector3(0, 0.46, -0.8);
const CHASE_OFFSET = new THREE.Vector3(
  GAME_CONSTANTS.CAMERA.OFFSET.x,
  GAME_CONSTANTS.CAMERA.OFFSET.y,
  GAME_CONSTANTS.CAMERA.OFFSET.z
);
const CAMERA_FOV = GAME_CONSTANTS.CAMERA.FOV;

const MINT_LOCK = /#5cffb0|var\(\s*--hud-lock\b/i;
const LIME_LOCK = /#00ff00|#0f0\b|rgb\(\s*0\s*,\s*255\s*,\s*0\s*\)/i;
const THREAT = /--hud-threat|#ff4d4d/i;

interface Pose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

interface Pixel {
  x: number;
  y: number;
}

function stubViewport(width: number, height: number, touch: boolean): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  GameConfig.isMobile = touch;
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: touch ? 5 : 0,
  });
  window.ontouchstart = touch ? () => undefined : null;
  window.matchMedia = ((query: string): MediaQueryList => {
    const landscape = width > height;
    const matches =
      (query.includes('pointer: coarse') && touch) ||
      (query.includes('pointer: fine') && !touch) ||
      (query.includes('orientation: landscape') && landscape) ||
      (query.includes('orientation: portrait') && !landscape);
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    };
  }) as typeof window.matchMedia;
  window.dispatchEvent(new Event('resize'));
}

function levelPose(): Pose {
  return { position: new THREE.Vector3(0, 0, 0), quaternion: new THREE.Quaternion() };
}

/** 偏航 / 俯仰 / 滚转后的机体姿态，放在世界里一个非原点的位置 */
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
    CAMERA_FOV,
    window.innerWidth / Math.max(window.innerHeight, 1),
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

/** 追尾：相机在机体后上方（机体局部 0, 5, 15），看向机体 */
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
    x: (ndc.x + 1) * 0.5 * window.innerWidth,
    y: (1 - ndc.y) * 0.5 * window.innerHeight,
  };
}

/** 机头轴线前方 600 米那一点的屏幕位置 */
function noseAxisPixel(pose: Pose, camera: THREE.Camera): Pixel {
  const ahead = new THREE.Vector3(0, 0, -AIM_DISTANCE)
    .applyQuaternion(pose.quaternion)
    .add(pose.position);
  return toPixel(ahead, camera);
}

/** 相机视线上、投影到屏幕 (px, py)、离相机平面 depth 米的世界坐标 */
function worldAtPixel(
  camera: THREE.PerspectiveCamera,
  px: number,
  py: number,
  depth: number
): THREE.Vector3 {
  const halfHeight = depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const halfWidth = halfHeight * camera.aspect;
  return new THREE.Vector3(
    ((px / window.innerWidth) * 2 - 1) * halfWidth,
    (1 - (py / window.innerHeight) * 2) * halfHeight,
    -depth
  ).applyMatrix4(camera.matrixWorld);
}

function enemyAtPixel(
  camera: THREE.PerspectiveCamera,
  px: number,
  py: number,
  depth = 300
): THREE.Object3D {
  const enemy = new THREE.Object3D();
  enemy.position.copy(worldAtPixel(camera, px, py, depth));
  return enemy;
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

function anchor(kind: string): HTMLElement {
  const match = lockRoot().querySelector<HTMLElement>(`[data-lock-anchor="${kind}"]`);
  expect(match, `expected [data-lock-anchor="${kind}"]`).toBeTruthy();
  return match as HTMLElement;
}

function part<T extends Element = HTMLElement>(selector: string): T {
  const match = lockRoot().querySelector<T>(selector);
  expect(match, `expected ${selector} inside #lock-on-indicator`).toBeTruthy();
  return match as T;
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

function parsePx(value: string): number {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)px$/i);
  expect(match, `expected a px length, got "${value}"`).toBeTruthy();
  return Number((match as RegExpMatchArray)[1]);
}

function expectedAcquireRadius(scale = 1): number {
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  return Math.max(44, Math.min(0.13 * shortSide * scale, 0.3 * shortSide));
}

describe('LockOnIndicator', () => {
  let indicator: LockOnIndicator;
  let originalIsMobile: boolean;
  let originalInnerWidth: number;
  let originalInnerHeight: number;
  let originalMatchMedia: typeof window.matchMedia;
  let originalMaxTouchPoints: number;
  let nowMs: number;

  /** 一个模拟步 + 一个渲染帧（时钟同步前进） */
  function frame(
    pose: Pose,
    camera: THREE.Camera,
    candidates: readonly THREE.Object3D[],
    dt = DT
  ): boolean {
    const locked = indicator.update(pose.position, candidates, camera, dt, pose.quaternion);
    indicator.renderUpdate(true, pose.position, pose.quaternion, camera, null, false);
    nowMs += dt * 1000;
    return locked;
  }

  function run(
    pose: Pose,
    camera: THREE.Camera,
    candidates: readonly THREE.Object3D[],
    seconds: number
  ): void {
    for (let i = 0; i < Math.round(seconds / DT); i += 1) {
      frame(pose, camera, candidates);
    }
  }

  function render(pose: Pose, camera: THREE.Camera, visible = true): void {
    indicator.renderUpdate(visible, pose.position, pose.quaternion, camera, null, false);
  }

  function recreate(width: number, height: number, touch: boolean): void {
    indicator.dispose();
    stubViewport(width, height, touch);
    indicator = new LockOnIndicator();
    indicator.init();
  }

  /** 第一人称平飞、准星在屏幕中心；敌机在准星右侧 offsetPx 像素处 */
  function centredRig(offsetPx = 0, depth = 300) {
    const pose = levelPose();
    const camera = eyeCamera(pose);
    const aim = noseAxisPixel(pose, camera);
    const enemy = enemyAtPixel(camera, aim.x + offsetPx, aim.y, depth);
    const moveEnemy = (pixelsRight: number): void => {
      enemy.position.copy(worldAtPixel(camera, aim.x + pixelsRight, aim.y, depth));
    };
    return { pose, camera, aim, enemy, moveEnemy };
  }

  beforeEach(() => {
    originalIsMobile = GameConfig.isMobile;
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    originalMatchMedia = window.matchMedia;
    originalMaxTouchPoints = navigator.maxTouchPoints;
    document.body.innerHTML = '';
    nowMs = 10_000;
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
    stubViewport(1280, 800, false);
    indicator = new LockOnIndicator();
    indicator.init();
    indicator.setLockTime(1.0);
  });

  afterEach(() => {
    indicator.dispose();
    vi.restoreAllMocks();
    resetLocale();
    GameConfig.isMobile = originalIsMobile;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      value: originalMaxTouchPoints,
    });
    window.matchMedia = originalMatchMedia;
    window.ontouchstart = null;
    document.body.innerHTML = '';
  });

  describe('aim reticle', () => {
    it('draws a single gun cross', () => {
      const pose = levelPose();
      render(pose, eyeCamera(pose));

      const cross = chrome('gun-cross');
      expect(isShown(cross)).toBe(true);
      expect(lockRoot().style.display).not.toBe('none');
    });

    it('puts the gun cross at screen centre for a camera at the pilot’s eye', () => {
      const pose = levelPose();
      render(pose, eyeCamera(pose));

      const position = screenPositionOf(chrome('gun-cross'));
      expect(Math.abs(position.x - window.innerWidth / 2)).toBeLessThan(1);
      expect(Math.abs(position.y - window.innerHeight / 2)).toBeLessThan(1.5);
    });

    it('puts the gun cross above screen centre for a chase camera behind and above', () => {
      const pose = levelPose();
      render(pose, chaseCamera(pose));

      // 相机在 (0, 5, 15) 俯视机体：视线下俯 atan(5 / 15)；机头前方 600 米那一点
      // 在相机坐标里只下俯 atan(5 / 615)，两者之差就是它高出画面中心的角度
      const above = Math.atan2(5, 15) - Math.atan2(5, 15 + AIM_DISTANCE);
      const expectedY =
        (window.innerHeight / 2) *
        (1 - Math.tan(above) / Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2)));
      const position = screenPositionOf(chrome('gun-cross'));

      expect(position.x).toBeCloseTo(window.innerWidth / 2, 0);
      expect(Math.abs(position.y - expectedY)).toBeLessThan(0.5);
      expect(position.y).toBeLessThan(window.innerHeight * 0.4);
      expect(isShown(chrome('gun-cross'))).toBe(true);
    });

    it.each([
      ['first person', eyeCamera],
      ['third person', chaseCamera],
    ])('follows the nose axis of a banked, turning aircraft in %s', (_view, makeCamera) => {
      const pose = bankedPose();
      const camera = makeCamera(pose);
      render(pose, camera);

      const expected = noseAxisPixel(pose, camera);
      const position = screenPositionOf(chrome('gun-cross'));
      expect(Math.abs(position.x - expected.x)).toBeLessThan(0.5);
      expect(Math.abs(position.y - expected.y)).toBeLessThan(0.5);
      expect(isShown(chrome('gun-cross'))).toBe(true);
    });

    it('moves with the nose from one render frame to the next', () => {
      const pose = levelPose();
      const camera = chaseCamera(pose);
      render(pose, camera);
      const before = screenPositionOf(chrome('gun-cross'));

      // 相机不动，机头向右偏 6°
      pose.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(-6));
      render(pose, camera);
      const after = screenPositionOf(chrome('gun-cross'));
      const expected = noseAxisPixel(pose, camera);

      expect(after.x).toBeGreaterThan(before.x + 20);
      expect(Math.abs(after.x - expected.x)).toBeLessThan(0.5);
      expect(Math.abs(after.y - expected.y)).toBeLessThan(0.5);
    });

    it.each<[LayoutDensity, number, number, boolean]>([
      ['desktop', 1280, 800, false],
      ['touch-landscape', 900, 400, true],
      ['touch-portrait', 400, 800, true],
    ])('draws the same gun cross on %s', (density, width, height, touch) => {
      recreate(width, height, touch);
      indicator.setLayoutDensity(density);
      const pose = levelPose();
      const camera = chaseCamera(pose);
      render(pose, camera);

      const cross = chrome('gun-cross');
      const expected = noseAxisPixel(pose, camera);
      const position = screenPositionOf(cross);
      expect(isShown(cross)).toBe(true);
      expect(Math.abs(position.x - expected.x)).toBeLessThan(0.5);
      expect(Math.abs(position.y - expected.y)).toBeLessThan(0.5);
      expect(position.y).toBeLessThan(height / 2);
    });

    it('is hidden when the caller says the aircraft is not flying', () => {
      const pose = levelPose();
      const camera = eyeCamera(pose);
      render(pose, camera, true);
      expect(isShown(chrome('gun-cross'))).toBe(true);

      render(pose, camera, false);
      expect(isShown(chrome('gun-cross'))).toBe(false);
      expect(isShown(chrome('acquire-ring'))).toBe(false);
      expect(indicator.getAimScreen().visible).toBe(false);

      render(pose, camera, true);
      expect(isShown(chrome('gun-cross'))).toBe(true);
    });

    it('is hidden while paused and comes back afterwards', () => {
      const pose = levelPose();
      const camera = eyeCamera(pose);
      render(pose, camera);

      indicator.setPaused(true);
      expect(isShown(chrome('gun-cross'))).toBe(false);
      render(pose, camera, true);
      expect(isShown(chrome('gun-cross')), 'render frames while paused').toBe(false);

      indicator.setPaused(false);
      render(pose, camera, true);
      expect(isShown(chrome('gun-cross'))).toBe(true);
    });

    it('is hidden when the aim point is behind the camera', () => {
      const pose = levelPose();
      const camera = createCamera();
      camera.position.set(0, 0, 0);
      camera.lookAt(0, 0, 100);
      camera.updateMatrixWorld(true);

      render(pose, camera);

      expect(isShown(chrome('gun-cross'))).toBe(false);
      expect(isShown(chrome('acquire-ring'))).toBe(false);
    });

    it('is hidden when the aim point is well outside the viewport, and returns with it', () => {
      const pose = levelPose();
      const camera = createCamera();
      camera.position.set(0, 0, 0);
      // 相机向左转 70°：机头轴线在画面右侧之外
      camera.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(70));
      camera.updateMatrixWorld(true);
      const offscreen = noseAxisPixel(pose, camera);
      expect(offscreen.x).toBeGreaterThan(window.innerWidth + 200);

      render(pose, camera);
      expect(isShown(chrome('gun-cross'))).toBe(false);

      camera.quaternion.identity();
      camera.updateMatrixWorld(true);
      render(pose, camera);
      expect(isShown(chrome('gun-cross'))).toBe(true);
    });

    it('is hidden for a non-finite aircraft position instead of being placed at NaN', () => {
      const pose = levelPose();
      const camera = eyeCamera(pose);
      render(pose, camera);
      pose.position.set(Number.NaN, 0, 0);

      render(pose, camera);

      expect(isShown(chrome('gun-cross'))).toBe(false);
      expect(anchor('reticle').style.transform).not.toMatch(/NaN|Infinity/);
    });

    it('ignores pointer input everywhere inside #lock-on-indicator, in every state', () => {
      const { pose, camera, enemy } = centredRig();
      const expectInert = (label: string): void => {
        const root = lockRoot();
        expect(getComputedStyle(root).pointerEvents, `${label}: root`).toBe('none');
        for (const node of root.querySelectorAll('*')) {
          expect(
            getComputedStyle(node).pointerEvents,
            `${label}: <${node.tagName.toLowerCase()} class="${node.getAttribute('class')}">`
          ).toBe('none');
        }
      };

      render(pose, camera);
      expectInert('search');
      run(pose, camera, [enemy], 0.3);
      expect(indicator.getLockState()).toBe('track');
      expectInert('track');
      run(pose, camera, [enemy], 1);
      expect(indicator.getLockState()).toBe('lock');
      expectInert('lock');
      indicator.showCue('no-lock');
      indicator.setMissileCount(0);
      render(pose, camera);
      expectInert('dry');

      const css = Array.from(document.querySelectorAll('style'))
        .map((style) => style.textContent ?? '')
        .filter((text) => text.includes('#lock-on-indicator'))
        .join('\n');
      expect(css).not.toMatch(/#lock-on-indicator[^{}]*\{[^}]*pointer-events\s*:\s*(?!none)/);
    });
  });

  describe('acquire ring', () => {
    it('is a hollow circle', () => {
      const pose = levelPose();
      render(pose, eyeCamera(pose));

      const ring = chrome('acquire-ring');
      expect(isShown(ring)).toBe(true);
      expect(ring.style.borderRadius).toBe('50%');
      expect(parsePx(ring.style.width)).toBeGreaterThan(0);
      expect(ring.style.height).toBe(ring.style.width);
      expect(parsePx(ring.style.borderWidth)).toBeGreaterThan(0);
      expect(ring.style.background.replace(/\s+/g, '')).toMatch(
        /^(transparent|none|rgba\(0,0,0,0\))/
      );
    });

    it.each<[string, number, number, boolean, LayoutDensity, number, number]>([
      ['desktop', 1280, 800, false, 'desktop', 1, 104],
      ['touch landscape phone', 900, 400, true, 'touch-landscape', 1, 52],
      ['touch portrait phone', 400, 800, true, 'touch-portrait', 1, 52],
      ['touch landscape tablet (no 180 px cap)', 1600, 1100, true, 'touch-landscape', 1, 143],
      ['touch portrait tablet (no 160 px cap)', 1100, 1600, true, 'touch-portrait', 1, 143],
      ['small viewport (44 px floor)', 320, 300, true, 'touch-landscape', 1, 44],
      ['desktop, lock radius x1.5', 1280, 800, false, 'desktop', 1.5, 156],
      ['desktop, lock radius x2', 1280, 800, false, 'desktop', 2, 208],
      ['touch landscape, lock radius x2', 900, 400, true, 'touch-landscape', 2, 104],
    ])(
      'has radius clamp(0.13 x short side x upgrade, 44 px, 0.30 x short side): %s',
      (_label, width, height, touch, density, scale, expected) => {
        recreate(width, height, touch);
        indicator.setLayoutDensity(density);
        indicator.setLockCircleScale(scale);

        expect(expectedAcquireRadius(scale)).toBeCloseTo(expected, 6);
        expect(indicator.getAcquireRadius()).toBeCloseTo(expected, 6);
        expect(indicator.getKeepRadius()).toBeCloseTo(expected * KEEP_RATIO, 6);
        const ring = chrome('acquire-ring');
        expect(Math.abs(parsePx(ring.style.width) - expected * 2)).toBeLessThanOrEqual(1);
        expect(ring.style.height).toBe(ring.style.width);
      }
    );

    it('uses the same rule on every layout density', () => {
      recreate(1000, 700, true);
      const radii = (['desktop', 'touch-landscape', 'touch-portrait'] as const).map((density) => {
        indicator.setLayoutDensity(density);
        expect(indicator.getLayoutDensity()).toBe(density);
        return indicator.getAcquireRadius();
      });

      expect(radii).toEqual([91, 91, 91]);
    });

    it('never exceeds 0.30 x the short side', () => {
      for (const [width, height] of [
        [1280, 800],
        [900, 400],
        [400, 800],
        [2048, 1536],
      ]) {
        recreate(width, height, false);
        indicator.setLockCircleScale(2);
        expect(indicator.getAcquireRadius()).toBeLessThanOrEqual(0.3 * Math.min(width, height));
      }
    });

    it('follows a viewport resize', () => {
      expect(indicator.getAcquireRadius()).toBeCloseTo(104, 6);

      stubViewport(800, 600, false);
      expect(indicator.getAcquireRadius()).toBeCloseTo(78, 6);
      expect(Math.abs(parsePx(chrome('acquire-ring').style.width) - 156)).toBeLessThanOrEqual(1);

      stubViewport(600, 1000, false);
      window.dispatchEvent(new Event('orientationchange'));
      expect(indicator.getAcquireRadius()).toBeCloseTo(78, 6);
    });

    it('projects the reticle against the resized viewport', () => {
      stubViewport(800, 600, false);
      const pose = levelPose();
      const camera = chaseCamera(pose);
      render(pose, camera);

      const expected = noseAxisPixel(pose, camera);
      const position = screenPositionOf(chrome('acquire-ring'));
      expect(expected.x).toBeCloseTo(400, 3);
      expect(Math.abs(position.x - expected.x)).toBeLessThan(0.5);
      expect(Math.abs(position.y - expected.y)).toBeLessThan(0.5);
    });

    it.each([
      ['first person', eyeCamera],
      ['third person', chaseCamera],
    ])('is centred on the nose-axis projection in %s', (_view, makeCamera) => {
      const pose = bankedPose();
      const camera = makeCamera(pose);
      render(pose, camera);

      const expected = noseAxisPixel(pose, camera);
      const position = screenPositionOf(chrome('acquire-ring'));
      expect(Math.abs(position.x - expected.x)).toBeLessThan(0.5);
      expect(Math.abs(position.y - expected.y)).toBeLessThan(0.5);
    });

    it('is not centred on the viewport in the chase view', () => {
      const pose = levelPose();
      const camera = chaseCamera(pose);
      render(pose, camera);

      const position = screenPositionOf(chrome('acquire-ring'));
      // 机头轴线在画面中心上方约 21%（1280 × 800 时约 169 像素），比捕获环半径还大
      expect(window.innerHeight / 2 - position.y).toBeGreaterThan(indicator.getAcquireRadius());
    });

    it('grows with setLockCircleScale while the gun cross keeps its size', () => {
      const pose = levelPose();
      render(pose, eyeCamera(pose));
      const ring = chrome('acquire-ring');
      const cross = chrome('gun-cross');
      const crossSize = (): string[] =>
        [cross, ...Array.from(cross.querySelectorAll('*'))].map((node) => {
          const style = getComputedStyle(node);
          return `${style.width} x ${style.height}`;
        });
      const ringBefore = parsePx(ring.style.width);
      const crossBefore = crossSize();
      const crossHtmlBefore = cross.outerHTML;
      expect(parsePx(getComputedStyle(cross).width)).toBeGreaterThan(0);

      indicator.setLockCircleScale(2);
      render(pose, eyeCamera(pose));

      expect(parsePx(ring.style.width)).toBeCloseTo(ringBefore * 2, 0);
      expect(crossSize()).toEqual(crossBefore);
      expect(cross.outerHTML).toBe(crossHtmlBefore);
    });

    it('keeps a finite radius for a bad scale', () => {
      for (const scale of [Number.NaN, Number.POSITIVE_INFINITY, -4, 0]) {
        indicator.setLockCircleScale(scale);
        const radius = indicator.getAcquireRadius();
        expect(Number.isFinite(radius), `scale ${scale}`).toBe(true);
        expect(radius).toBeGreaterThanOrEqual(44);
        expect(radius).toBeLessThanOrEqual(0.3 * 800);
      }
    });
  });

  describe('always-on seeker', () => {
    it('tracks and locks a hostile on the reticle with no lock mode to enter', () => {
      const { pose, camera, enemy } = centredRig();

      frame(pose, camera, [enemy]);
      expect(indicator.getTrackedTarget()).toBe(enemy);
      expect(indicator.isLocked()).toBe(false);

      let lockedAt = -1;
      for (let i = 1; i <= 120 && lockedAt < 0; i += 1) {
        if (frame(pose, camera, [enemy])) lockedAt = i;
      }

      // 基础锁定时间 1.0 秒
      expect(lockedAt * DT).toBeGreaterThan(1.0 - 2 * DT);
      expect(lockedAt * DT).toBeLessThan(1.0 + 3 * DT);
      expect(indicator.isLocked()).toBe(true);
      expect(indicator.getCurrentTarget()).toBe(enemy);
      expect(indicator.getLockProgress()).toBe(1);
    });

    it('follows setLockTime', () => {
      const { pose, camera, enemy } = centredRig();
      indicator.setLockTime(0.5);

      frame(pose, camera, [enemy]);
      run(pose, camera, [enemy], 0.4);
      expect(indicator.isLocked()).toBe(false);
      run(pose, camera, [enemy], 0.15);
      expect(indicator.isLocked()).toBe(true);
    });

    it('takes its reference from the nose axis, not from the middle of the screen', () => {
      const pose = levelPose();
      const camera = chaseCamera(pose);
      const aim = noseAxisPixel(pose, camera);

      const atCentre = enemyAtPixel(camera, window.innerWidth / 2, window.innerHeight / 2);
      run(pose, camera, [atCentre], 1.5);
      expect(indicator.getTrackedTarget(), 'screen centre is outside the ring').toBeNull();
      expect(indicator.getLockProgress()).toBe(0);

      const onNose = enemyAtPixel(camera, aim.x, aim.y);
      frame(pose, camera, [atCentre, onNose]);
      expect(indicator.getTrackedTarget()).toBe(onNose);
    });

    it('acquires just inside the ring around the nose axis and not just outside', () => {
      const pose = bankedPose();
      const camera = chaseCamera(pose);
      const aim = noseAxisPixel(pose, camera);
      const radius = indicator.getAcquireRadius();

      const outside = enemyAtPixel(camera, aim.x + radius + 3, aim.y);
      run(pose, camera, [outside], 0.5);
      expect(indicator.getTrackedTarget()).toBeNull();

      const inside = enemyAtPixel(camera, aim.x, aim.y + radius - 3);
      frame(pose, camera, [outside, inside]);
      expect(indicator.getTrackedTarget()).toBe(inside);
    });

    it('holds a completed lock inside the keep ring and through the grace after it', () => {
      const { pose, camera, enemy, moveEnemy } = centredRig();
      run(pose, camera, [enemy], 1.2);
      expect(indicator.isLocked()).toBe(true);
      const keep = indicator.getKeepRadius();
      expect(keep).toBeCloseTo(indicator.getAcquireRadius() * KEEP_RATIO, 6);

      moveEnemy(keep - 6);
      run(pose, camera, [enemy], 2);
      expect(indicator.isLocked()).toBe(true);

      moveEnemy(keep + 6);
      run(pose, camera, [enemy], GRACE_TIME - 0.1);
      expect(indicator.isLocked()).toBe(true);
      run(pose, camera, [enemy], 0.2);
      expect(indicator.isLocked()).toBe(false);
    });

    it('does not track with no missiles aboard', () => {
      const { pose, camera, enemy } = centredRig();
      indicator.setMissileCount(0);

      for (let i = 0; i < 180; i += 1) {
        expect(frame(pose, camera, [enemy])).toBe(false);
      }

      expect(indicator.getTrackedTarget()).toBeNull();
      expect(indicator.getCurrentTarget()).toBeNull();
      expect(indicator.isLocked()).toBe(false);
      expect(indicator.getLockProgress()).toBe(0);
    });

    it('starts tracking as soon as a missile is aboard again', () => {
      const { pose, camera, enemy } = centredRig();
      indicator.setMissileCount(0);
      run(pose, camera, [enemy], 1);

      indicator.setMissileCount(1);
      frame(pose, camera, [enemy]);

      expect(indicator.getTrackedTarget()).toBe(enemy);
      expect(indicator.getLockProgress()).toBeLessThan(0.05);
    });

    it('drops the lock when the last missile is gone', () => {
      const { pose, camera, enemy } = centredRig();
      run(pose, camera, [enemy], 1.2);
      expect(indicator.isLocked()).toBe(true);

      indicator.setMissileCount(0);

      expect(indicator.isLocked()).toBe(false);
      expect(indicator.getTrackedTarget()).toBeNull();
      expect(indicator.getLockProgress()).toBe(0);
    });

    it('keeps the lock while missiles remain after one is spent', () => {
      const { pose, camera, enemy } = centredRig();
      indicator.setMissileCount(3);
      run(pose, camera, [enemy], 1.2);
      expect(indicator.isLocked()).toBe(true);

      indicator.setMissileCount(2);
      frame(pose, camera, [enemy]);

      expect(indicator.isLocked()).toBe(true);
      expect(indicator.getCurrentTarget()).toBe(enemy);
    });

    it('drops a destroyed target at once', () => {
      const { pose, camera, enemy } = centredRig();
      run(pose, camera, [enemy], 1.2);
      expect(indicator.isLocked()).toBe(true);

      frame(pose, camera, []);

      expect(indicator.isLocked()).toBe(false);
      expect(indicator.getTrackedTarget()).toBeNull();
    });
  });

  describe('feedback', () => {
    it('shows the searching state with no target chrome', () => {
      const pose = levelPose();
      const camera = eyeCamera(pose);
      run(pose, camera, [], 0.2);

      expect(lockRoot().getAttribute('data-lock-state')).toBe('search');
      expect(indicator.getLockState()).toBe('search');
      expect(isShown(anchor('target'))).toBe(false);
      expect(isShown(chrome('acquire-ring'))).toBe(true);
    });

    it('brackets the tracked target where it is on screen', () => {
      const pose = bankedPose();
      const camera = chaseCamera(pose);
      const aim = noseAxisPixel(pose, camera);
      const enemy = enemyAtPixel(camera, aim.x + 35, aim.y - 20, 420);

      run(pose, camera, [enemy], 0.3);

      expect(lockRoot().getAttribute('data-lock-state')).toBe('track');
      const brackets = part('.lk-box');
      expect(isShown(brackets)).toBe(true);
      expect(brackets.children.length).toBe(4);
      const position = screenPositionOf(brackets);
      expect(Math.abs(position.x - (aim.x + 35))).toBeLessThan(0.5);
      expect(Math.abs(position.y - (aim.y - 20))).toBeLessThan(0.5);
    });

    it('tightens the brackets and fills the progress arc as the lock progresses', () => {
      const { pose, camera, enemy } = centredRig();
      const brackets = part('.lk-box');
      const stroke = part<SVGCircleElement>('.lk-arc circle');
      const circumference = Number(stroke.getAttribute('stroke-dasharray'));
      expect(circumference).toBeGreaterThan(0);
      const arcFill = (): number => 1 - Number(stroke.style.strokeDashoffset) / circumference;

      frame(pose, camera, [enemy]);
      const sizes: number[] = [parsePx(brackets.style.width)];
      const fills: number[] = [arcFill()];
      expect(fills[0]).toBeLessThan(0.05);

      for (const target of [0.25, 0.5, 0.75]) {
        run(pose, camera, [enemy], 0.25);
        expect(indicator.getLockState()).toBe('track');
        expect(indicator.getLockProgress()).toBeCloseTo(target, 1);
        expect(arcFill()).toBeCloseTo(indicator.getLockProgress(), 1);
        expect(brackets.style.height).toBe(brackets.style.width);
        sizes.push(parsePx(brackets.style.width));
        fills.push(arcFill());
      }

      for (let i = 1; i < sizes.length; i += 1) {
        expect(sizes[i], `bracket size at step ${i}`).toBeLessThan(sizes[i - 1]);
        expect(fills[i], `arc fill at step ${i}`).toBeGreaterThan(fills[i - 1]);
      }

      run(pose, camera, [enemy], 0.4);
      expect(indicator.getLockState()).toBe('lock');
      expect(parsePx(brackets.style.width)).toBeLessThan(sizes[sizes.length - 1]);
    });

    it('lets the brackets and arc open again when progress decays', () => {
      const { pose, camera, enemy, moveEnemy } = centredRig();
      const brackets = part('.lk-box');
      run(pose, camera, [enemy], 0.8);
      const tight = parsePx(brackets.style.width);
      const progress = indicator.getLockProgress();

      moveEnemy(indicator.getAcquireRadius() * 1.3);
      run(pose, camera, [enemy], 0.3);

      expect(indicator.getLockState()).toBe('track');
      expect(indicator.getLockProgress()).toBeLessThan(progress);
      expect(indicator.getLockProgress()).toBeGreaterThan(0.2);
      expect(parsePx(brackets.style.width)).toBeGreaterThan(tight);
    });

    it('turns to the lock colour from the HUD token when the lock completes', () => {
      const { pose, camera, enemy } = centredRig();
      run(pose, camera, [enemy], 0.5);
      expect(getComputedStyle(lockRoot()).color).not.toMatch(MINT_LOCK);

      run(pose, camera, [enemy], 0.7);

      const root = lockRoot();
      expect(root.getAttribute('data-lock-state')).toBe('lock');
      expect(indicator.getLockState()).toBe('lock');
      expect(getComputedStyle(root).color).toMatch(MINT_LOCK);
      const tokens = document.getElementById('hud-tokens')?.textContent ?? '';
      expect(tokens).toMatch(/--hud-lock\s*:\s*#5CFFB0/i);
      const css = Array.from(document.querySelectorAll('style'))
        .map((style) => style.textContent ?? '')
        .filter((text) => text.includes('#lock-on-indicator'))
        .join('\n');
      expect(css).not.toMatch(LIME_LOCK);
    });

    it('shows a LOCK label only once locked', () => {
      const { pose, camera, enemy } = centredRig();
      const tag = part('.lk-label-tag');

      run(pose, camera, [enemy], 0.5);
      expect(getComputedStyle(tag).display).toBe('none');

      run(pose, camera, [enemy], 0.7);
      expect(tag.textContent).toBe('LOCK');
      expect(getComputedStyle(tag).display).not.toBe('none');
      expect(isShown(tag)).toBe(true);
    });

    it.each([
      [337, '340 m'],
      [334, '330 m'],
      [1196, '1200 m'],
      [95.2, '100 m'],
      [250, '250 m'],
    ])('shows the range rounded to 10 m: %s m reads "%s"', (distance, label) => {
      const pose = levelPose();
      const camera = eyeCamera(pose);
      const enemy = new THREE.Object3D();
      enemy.position.set(0, 0, -distance);

      run(pose, camera, [enemy], 1.2);

      expect(indicator.isLocked()).toBe(true);
      expect(part('.lk-label-range').textContent).toBe(label);
      expect(isShown(part('.lk-label-range'))).toBe(true);
    });

    it('measures the range from the aircraft and keeps it current', () => {
      const pose = levelPose();
      pose.position.set(0, 0, 200);
      const camera = eyeCamera(pose);
      const enemy = new THREE.Object3D();
      enemy.position.set(0, 0, -300);
      run(pose, camera, [enemy], 1.2);
      expect(part('.lk-label-range').textContent).toBe('500 m');

      enemy.position.set(0, 0, -60);
      frame(pose, camera, [enemy]);
      expect(part('.lk-label-range').textContent).toBe('260 m');
    });

    it('words the LOCK label in the interface language', () => {
      const { pose, camera, enemy } = centredRig();
      run(pose, camera, [enemy], 1.2);
      expect(part('.lk-label-tag').textContent).toBe('LOCK');

      setLocale('zh-CN');
      expect(part('.lk-label-tag').textContent).toBe('锁定');

      setLocale('en');
      expect(part('.lk-label-tag').textContent).toBe('LOCK');
    });

    // 曾经的缺陷（b35f8e1 已修）：和 HUD 状态列标签同一个问题。LockOnIndicator 在开始菜单阶段
    // 就已创建，进入战斗时才 init()；玩家在开始菜单里切到中文再开局，目标上的标签仍是创建时的
    // LOCK，直到下一次切换语言。
    it('words the LOCK label in the language picked before the indicator comes up', () => {
      indicator.dispose();
      setLocale('en');
      indicator = new LockOnIndicator();
      setLocale('zh-CN');
      indicator.init();
      const { pose, camera, enemy } = centredRig();

      run(pose, camera, [enemy], 1.2);

      expect(indicator.isLocked()).toBe(true);
      expect(part('.lk-label-tag').textContent).toBe('锁定');
    });

    it('shows a brief break state when a completed lock is lost', () => {
      const { pose, camera, enemy, moveEnemy } = centredRig();
      run(pose, camera, [enemy], 1.2);
      expect(indicator.getLockState()).toBe('lock');

      moveEnemy(indicator.getKeepRadius() + 80);
      run(pose, camera, [enemy], GRACE_TIME - 0.1);
      expect(indicator.getLockState(), 'still inside the grace').toBe('lock');

      run(pose, camera, [enemy], 0.15);
      const root = lockRoot();
      expect(indicator.getLockState()).toBe('break');
      expect(root.getAttribute('data-lock-state')).toBe('break');
      expect(getComputedStyle(root).color).toMatch(THREAT);
      expect(getComputedStyle(root).color).not.toMatch(MINT_LOCK);
      expect(getComputedStyle(part('.lk-label-tag')).display).toBe('none');

      // “短暂”：一秒之内回到搜索状态
      run(pose, camera, [enemy], 1);
      expect(indicator.getLockState()).toBe('search');
      expect(root.getAttribute('data-lock-state')).toBe('search');
    });

    it('does not show the break state while progress merely decays', () => {
      const { pose, camera, enemy, moveEnemy } = centredRig();
      run(pose, camera, [enemy], 0.6);

      moveEnemy(indicator.getAcquireRadius() * 1.3);
      for (let i = 0; i < 20; i += 1) {
        frame(pose, camera, [enemy]);
        expect(indicator.getLockState()).toBe('track');
      }
    });

    it('goes straight back to tracking when a new target is acquired during the break', () => {
      const { pose, camera, enemy, moveEnemy } = centredRig();
      run(pose, camera, [enemy], 1.2);
      moveEnemy(indicator.getKeepRadius() + 80);
      run(pose, camera, [enemy], GRACE_TIME + 0.05);
      expect(indicator.getLockState()).toBe('break');

      moveEnemy(0);
      frame(pose, camera, [enemy]);

      expect(indicator.getLockState()).toBe('track');
    });

    describe('#missile-button', () => {
      let button: HTMLButtonElement;

      beforeEach(() => {
        button = document.createElement('button');
        button.id = 'missile-button';
        document.body.appendChild(button);
      });

      it('carries is-lock and is-ready while locked with a missile ready', () => {
        const { pose, camera, enemy } = centredRig();
        indicator.setMissileCount(3);

        run(pose, camera, [enemy], 0.5);
        expect(button.classList.contains('is-lock')).toBe(false);
        expect(button.classList.contains('is-ready')).toBe(false);

        run(pose, camera, [enemy], 0.7);
        expect(indicator.isLocked()).toBe(true);
        expect(button.classList.contains('is-lock')).toBe(true);
        expect(button.classList.contains('is-ready')).toBe(true);
      });

      it('loses them when the lock is lost', () => {
        const { pose, camera, enemy, moveEnemy } = centredRig();
        run(pose, camera, [enemy], 1.2);
        expect(button.classList.contains('is-ready')).toBe(true);

        moveEnemy(indicator.getKeepRadius() + 80);
        run(pose, camera, [enemy], GRACE_TIME + 0.1);

        expect(indicator.isLocked()).toBe(false);
        expect(button.classList.contains('is-lock')).toBe(false);
        expect(button.classList.contains('is-ready')).toBe(false);
      });

      it('loses them when the locked target is destroyed', () => {
        const { pose, camera, enemy } = centredRig();
        run(pose, camera, [enemy], 1.2);
        expect(button.classList.contains('is-ready')).toBe(true);

        frame(pose, camera, []);

        expect(button.classList.contains('is-lock')).toBe(false);
        expect(button.classList.contains('is-ready')).toBe(false);
      });

      it('loses them when the last missile is spent', () => {
        const { pose, camera, enemy } = centredRig();
        indicator.setMissileCount(1);
        run(pose, camera, [enemy], 1.2);
        expect(button.classList.contains('is-ready')).toBe(true);

        indicator.setMissileCount(0);

        expect(button.classList.contains('is-lock')).toBe(false);
        expect(button.classList.contains('is-ready')).toBe(false);
      });

      it('never shows ready without a missile, even with a target on the reticle', () => {
        const { pose, camera, enemy } = centredRig();
        indicator.setMissileCount(0);

        run(pose, camera, [enemy], 2);

        expect(button.classList.contains('is-lock')).toBe(false);
        expect(button.classList.contains('is-ready')).toBe(false);
      });

      it('clears its state classes on dispose', () => {
        const { pose, camera, enemy } = centredRig();
        run(pose, camera, [enemy], 1.2);

        indicator.dispose();

        expect(button.classList.contains('is-lock')).toBe(false);
        expect(button.classList.contains('is-ready')).toBe(false);
        expect(document.getElementById('lock-on-indicator')).toBeNull();
      });
    });

    describe('cues', () => {
      it('shows NO LOCK under the reticle', () => {
        const pose = levelPose();
        const camera = chaseCamera(pose);
        render(pose, camera);
        const cue = chrome('cue');
        expect(isShown(cue)).toBe(false);

        indicator.showCue('no-lock');
        render(pose, camera);

        expect(isShown(cue)).toBe(true);
        expect(cue.textContent).toBe('NO LOCK');
        const expected = noseAxisPixel(pose, camera);
        const position = screenPositionOf(cue);
        expect(Math.abs(position.x - expected.x)).toBeLessThan(0.5);
        expect(Math.abs(position.y - expected.y)).toBeLessThan(0.5);
      });

      it('shows NO MSL, not NO MISSILE', () => {
        const pose = levelPose();
        const camera = eyeCamera(pose);
        indicator.setMissileCount(0);

        indicator.showCue('no-missile');
        render(pose, camera);

        const cue = chrome('cue');
        expect(isShown(cue)).toBe(true);
        expect(cue.textContent).toBe('NO MSL');
        expect(lockRoot().textContent ?? '').not.toContain('NO MISSILE');
      });

      it('words the cues in the interface language', () => {
        const pose = levelPose();
        const camera = eyeCamera(pose);
        indicator.showCue('no-lock');
        render(pose, camera);

        setLocale('zh-CN');
        expect(chrome('cue').textContent).toBe('未锁定');
        indicator.showCue('no-missile');
        expect(chrome('cue').textContent).toBe('无导弹');

        setLocale('en');
        expect(chrome('cue').textContent).toBe('NO MSL');
      });

      it('clears the cue after a moment', () => {
        const pose = levelPose();
        const camera = eyeCamera(pose);
        indicator.showCue('no-lock');
        run(pose, camera, [], 0.2);
        expect(isShown(chrome('cue'))).toBe(true);

        run(pose, camera, [], 3);

        expect(isShown(chrome('cue'))).toBe(false);
      });
    });

    describe('gun lead marker', () => {
      it('is drawn at the screen position of the lead point it is given', () => {
        const pose = levelPose();
        const camera = chaseCamera(pose);
        const lead = worldAtPixel(camera, 700, 260, 280);

        indicator.renderUpdate(true, pose.position, pose.quaternion, camera, lead, false);

        const marker = anchor('lead');
        expect(isShown(marker)).toBe(true);
        const position = screenPositionOf(marker);
        expect(Math.abs(position.x - 700)).toBeLessThan(0.5);
        expect(Math.abs(position.y - 260)).toBeLessThan(0.5);
      });

      it('is hidden when there is no lead point or it is behind the camera', () => {
        const pose = levelPose();
        const camera = eyeCamera(pose);
        const lead = worldAtPixel(camera, 700, 260, 280);
        indicator.renderUpdate(true, pose.position, pose.quaternion, camera, lead, false);
        expect(isShown(anchor('lead'))).toBe(true);

        indicator.renderUpdate(true, pose.position, pose.quaternion, camera, null, false);
        expect(isShown(anchor('lead'))).toBe(false);

        const behind = new THREE.Vector3(0, 0, 200);
        indicator.renderUpdate(true, pose.position, pose.quaternion, camera, behind, false);
        expect(isShown(anchor('lead'))).toBe(false);

        const broken = new THREE.Vector3(Number.NaN, 0, -200);
        indicator.renderUpdate(true, pose.position, pose.quaternion, camera, broken, false);
        expect(isShown(anchor('lead'))).toBe(false);
      });
    });
  });

  /**
   * C4：触屏辅助把机炮十字拉到“子弹真正飞去的方向”上。
   * 十字画在辅助方向上、瞄准点那么远的一点的投影处（不给距离时 600 米）；捕获环、提示、
   * 导弹余量和导引头用的准星位置都留在机头轴线上。
   */
  describe('gun cross with aim assist', () => {
    const VIEWS = [
      ['first person, level', levelPose, eyeCamera],
      ['first person, banked', bankedPose, eyeCamera],
      ['chase view, level', levelPose, chaseCamera],
      ['chase view, banked', bankedPose, chaseCamera],
    ] as const;

    /** 机头方向向机体右侧偏 rightDeg 度、向机体上方偏 upDeg 度 */
    function offNose(pose: Pose, rightDeg: number, upDeg = 0): THREE.Vector3 {
      return new THREE.Vector3(
        Math.tan(THREE.MathUtils.degToRad(rightDeg)),
        Math.tan(THREE.MathUtils.degToRad(upDeg)),
        -1
      )
        .normalize()
        .applyQuaternion(pose.quaternion);
    }

    function renderAssisted(
      pose: Pose,
      camera: THREE.Camera,
      direction: THREE.Vector3 | null,
      distance?: number
    ): void {
      if (distance === undefined) {
        indicator.renderUpdate(
          true,
          pose.position,
          pose.quaternion,
          camera,
          null,
          false,
          direction
        );
      } else {
        indicator.renderUpdate(
          true,
          pose.position,
          pose.quaternion,
          camera,
          null,
          false,
          direction,
          distance
        );
      }
    }

    /** 辅助方向上 distance 米处那一点的屏幕位置 */
    function aimedPixel(
      pose: Pose,
      camera: THREE.Camera,
      direction: THREE.Vector3,
      distance: number
    ): Pixel {
      return toPixel(pose.position.clone().addScaledVector(direction, distance), camera);
    }

    function gunAssistFlag(): string | null {
      return anchor('reticle').getAttribute('data-gun-assist');
    }

    function expectAt(actual: Pixel, expected: Pixel, tolerance = 1): void {
      expect(Math.abs(actual.x - expected.x), `x: ${actual.x} vs ${expected.x}`).toBeLessThan(
        tolerance
      );
      expect(Math.abs(actual.y - expected.y), `y: ${actual.y} vs ${expected.y}`).toBeLessThan(
        tolerance
      );
    }

    /** 第一人称平飞：让十字正好落在机头轴线右侧 pixelsRight 像素处的辅助方向与距离 */
    function pixelRig() {
      const pose = levelPose();
      const camera = eyeCamera(pose);
      const aim = noseAxisPixel(pose, camera);
      const crossAt = (pixelsRight: number, pixelsDown = 0): void => {
        const point = worldAtPixel(camera, aim.x + pixelsRight, aim.y + pixelsDown, 300);
        const offset = point.sub(pose.position);
        renderAssisted(pose, camera, offset.clone().normalize(), offset.length());
      };
      return { pose, camera, aim, crossAt };
    }

    describe('where the cross is drawn', () => {
      it.each(VIEWS)(
        'is where the assisted direction meets the aim range (%s)',
        (_name, makePose, makeCamera) => {
          const pose = makePose();
          const camera = makeCamera(pose);
          const direction = offNose(pose, 2, 1);

          renderAssisted(pose, camera, direction, 300);

          const expected = aimedPixel(pose, camera, direction, 300);
          const nose = noseAxisPixel(pose, camera);
          expect(Math.hypot(expected.x - nose.x, expected.y - nose.y)).toBeGreaterThan(10);
          expect(isShown(chrome('gun-cross'))).toBe(true);
          expectAt(screenPositionOf(chrome('gun-cross')), expected);
          const reported = indicator.getGunCrossScreen();
          expect(reported.visible).toBe(true);
          expectAt(reported, expected, 0.01);
        }
      );

      it.each([100, 200, 450])(
        'is drawn at the aim point’s range: %s m in the chase view',
        (distance) => {
          const pose = bankedPose();
          const camera = chaseCamera(pose);
          const direction = offNose(pose, -1.5, 1);

          renderAssisted(pose, camera, direction, distance);

          const expected = aimedPixel(pose, camera, direction, distance);
          const atReference = aimedPixel(pose, camera, direction, AIM_DISTANCE);
          // 追尾相机不在炮口：同一个方向上远近不同的点在屏幕上不重合
          expect(
            Math.hypot(expected.x - atReference.x, expected.y - atReference.y)
          ).toBeGreaterThan(1.5);
          expectAt(screenPositionOf(chrome('gun-cross')), expected, 0.5);
          expectAt(indicator.getGunCrossScreen(), expected, 0.01);
        }
      );

      it('lands on the aim point itself in both views', () => {
        for (const makeCamera of [eyeCamera, chaseCamera]) {
          const pose = bankedPose();
          const camera = makeCamera(pose);
          const direction = offNose(pose, 2, -1.2);
          const aimPoint = pose.position.clone().addScaledVector(direction, 260);

          renderAssisted(pose, camera, direction, 260);

          expectAt(screenPositionOf(chrome('gun-cross')), toPixel(aimPoint, camera), 0.5);
        }
      });

      it('is drawn at 600 m when no range is given', () => {
        const pose = levelPose();
        const camera = chaseCamera(pose);
        const direction = offNose(pose, 2, 1);

        renderAssisted(pose, camera, direction);

        expectAt(indicator.getGunCrossScreen(), aimedPixel(pose, camera, direction, 600), 0.01);
      });

      it.each([0, -120, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
        'falls back to 600 m for a range of %s',
        (distance) => {
          const pose = levelPose();
          const camera = chaseCamera(pose);
          const direction = offNose(pose, 2, 1);

          renderAssisted(pose, camera, direction, distance);

          const reported = indicator.getGunCrossScreen();
          expect(reported.visible).toBe(true);
          expectAt(reported, aimedPixel(pose, camera, direction, 600), 0.01);
        }
      );

      it('follows the direction from frame to frame', () => {
        const pose = levelPose();
        const camera = eyeCamera(pose);

        for (const [right, up] of [
          [0.5, 0],
          [1.5, -1],
          [-2.2, 0.8],
          [0.2, 2.4],
        ]) {
          const direction = offNose(pose, right, up);
          renderAssisted(pose, camera, direction, 350);
          expectAt(
            screenPositionOf(chrome('gun-cross')),
            aimedPixel(pose, camera, direction, 350),
            0.5
          );
        }
      });

      it('moves the cross even for a shift too small to be flagged', () => {
        const { aim, crossAt } = pixelRig();

        crossAt(1.5, -1);

        expectAt(screenPositionOf(chrome('gun-cross')), { x: aim.x + 1.5, y: aim.y - 1 }, 0.3);
      });

      it('returns to the nose axis when the assist ends', () => {
        const pose = levelPose();
        const camera = eyeCamera(pose);
        renderAssisted(pose, camera, offNose(pose, 2, 1), 300);
        expect(gunAssistFlag()).toBe('true');

        renderAssisted(pose, camera, null);

        const nose = noseAxisPixel(pose, camera);
        expectAt(screenPositionOf(chrome('gun-cross')), nose, 0.01);
        expectAt(indicator.getGunCrossScreen(), nose, 0.01);
        expect(isShown(chrome('gun-cross'))).toBe(true);
        expect(gunAssistFlag()).toBe('false');
        expect(indicator.isGunCrossAssisted()).toBe(false);
      });

      it('is on the nose axis with no assist, exactly as before', () => {
        const pose = bankedPose();
        const camera = chaseCamera(pose);

        render(pose, camera);

        const nose = noseAxisPixel(pose, camera);
        expectAt(screenPositionOf(chrome('gun-cross')), nose, 0.5);
        expectAt(indicator.getGunCrossScreen(), indicator.getAimScreen(), 1e-9);
        expect(gunAssistFlag()).toBe('false');
      });
    });

    describe('marked as assisted', () => {
      it('carries data-gun-assist="true" on the reticle anchor while the cross is pulled away', () => {
        const pose = levelPose();
        const camera = eyeCamera(pose);

        renderAssisted(pose, camera, offNose(pose, 2, 1), 300);

        expect(gunAssistFlag()).toBe('true');
        expect(indicator.isGunCrossAssisted()).toBe(true);
      });

      it('carries data-gun-assist="false" with no assist', () => {
        const pose = levelPose();

        render(pose, eyeCamera(pose));

        expect(gunAssistFlag()).toBe('false');
        expect(indicator.isGunCrossAssisted()).toBe(false);
      });

      it('is not flagged for an assisted direction that is the nose axis itself', () => {
        const pose = levelPose();
        const camera = eyeCamera(pose);

        renderAssisted(pose, camera, offNose(pose, 0, 0), 300);

        expect(gunAssistFlag()).toBe('false');
        expect(isShown(chrome('gun-cross'))).toBe(true);
      });

      /** 十字从机头轴线慢慢拉开再慢慢收回：记下标记打开 / 关掉时的偏移（像素） */
      function sweepThresholds(): { on: number; off: number } {
        const { crossAt } = pixelRig();
        let on: number | null = null;
        let off: number | null = null;
        for (let px = 0; px <= 10; px += 0.25) {
          crossAt(px);
          if (on === null && gunAssistFlag() === 'true') on = px;
        }
        for (let px = 10; px >= 0; px -= 0.25) {
          crossAt(px);
          if (off === null && gunAssistFlag() === 'false') off = px;
        }
        expect(on, 'the cross should be flagged somewhere within 10 px').not.toBeNull();
        expect(off, 'the flag should clear on the way back').not.toBeNull();
        return { on: on as number, off: off as number };
      }

      it('is flagged only once the shift can be seen, within a few pixels', () => {
        const { on } = sweepThresholds();

        expect(on).toBeGreaterThan(0.5);
        expect(on).toBeLessThanOrEqual(6);
      });

      it('lets go at a smaller shift than the one that set it (hysteresis)', () => {
        const { on, off } = sweepThresholds();

        expect(off).toBeLessThan(on - 0.5);
        expect(off).toBeGreaterThanOrEqual(0);
      });

      it('does not flicker when the shift hovers between the two thresholds', () => {
        const { on, off } = sweepThresholds();
        const middle = (on + off) / 2;
        const wobble = (on - off) / 4;
        const { crossAt } = pixelRig();

        // 从没有偏移进来：在中间地带晃，一直不亮
        crossAt(0);
        for (let i = 0; i < 40; i += 1) {
          crossAt(middle + wobble * Math.sin(i));
          expect(gunAssistFlag(), `rising, frame ${i}`).toBe('false');
        }
        // 从大偏移回来：在同一个地带晃，一直亮着
        crossAt(on + 4);
        expect(gunAssistFlag()).toBe('true');
        for (let i = 0; i < 40; i += 1) {
          crossAt(middle + wobble * Math.sin(i));
          expect(gunAssistFlag(), `falling, frame ${i}`).toBe('true');
        }
        crossAt(0);
        expect(gunAssistFlag()).toBe('false');
      });

      it('measures the shift in any direction on screen', () => {
        const { on } = sweepThresholds();
        const { crossAt } = pixelRig();

        crossAt(0, -(on + 2));

        expect(gunAssistFlag()).toBe('true');
      });
    });

    describe('nose marker', () => {
      it('sits on the true nose position while the cross is pulled away', () => {
        for (const [, makePose, makeCamera] of VIEWS) {
          const pose = makePose();
          const camera = makeCamera(pose);

          renderAssisted(pose, camera, offNose(pose, 2.2, -1), 250);

          const marker = chrome('nose-mark');
          expectAt(screenPositionOf(marker), noseAxisPixel(pose, camera), 0.5);
          expect(isShown(marker)).toBe(true);
        }
      });

      it('is displayed only while the cross is flagged as assisted', () => {
        const pose = levelPose();
        const camera = eyeCamera(pose);
        const marker = chrome('nose-mark');

        render(pose, camera);
        expect(getComputedStyle(marker).display).toBe('none');

        renderAssisted(pose, camera, offNose(pose, 2, 1), 300);
        expect(getComputedStyle(marker).display).not.toBe('none');

        renderAssisted(pose, camera, null);
        expect(getComputedStyle(marker).display).toBe('none');
      });

      it('is a dim mark, not a second gun cross', () => {
        const pose = levelPose();
        renderAssisted(pose, eyeCamera(pose), offNose(pose, 2, 1), 300);
        const marker = chrome('nose-mark');

        expect(marker).not.toBe(chrome('gun-cross'));
        expect(marker.contains(chrome('gun-cross'))).toBe(false);
        const opacity = Number(getComputedStyle(marker).opacity);
        expect(opacity).toBeGreaterThan(0);
        expect(opacity).toBeLessThan(1);
      });
    });

    describe('what stays on the nose axis', () => {
      it.each(VIEWS)(
        'keeps the acquire ring, the cue and the missile count where they were (%s)',
        (_name, makePose, makeCamera) => {
          const pose = makePose();
          const camera = makeCamera(pose);
          indicator.setMissileCount(2);
          indicator.showCue('no-lock');
          render(pose, camera);
          const before = {
            ring: screenPositionOf(chrome('acquire-ring')),
            cue: screenPositionOf(chrome('cue')),
            count: screenPositionOf(chrome('missile-count')),
            reticle: screenPositionOf(anchor('reticle')),
            aim: { ...indicator.getAimScreen() },
          };

          renderAssisted(pose, camera, offNose(pose, 2.4, 1.5), 200);

          const nose = noseAxisPixel(pose, camera);
          const cross = screenPositionOf(chrome('gun-cross'));
          expect(Math.hypot(cross.x - nose.x, cross.y - nose.y)).toBeGreaterThan(10);
          expect(screenPositionOf(chrome('acquire-ring'))).toEqual(before.ring);
          expect(screenPositionOf(chrome('cue'))).toEqual(before.cue);
          expect(screenPositionOf(chrome('missile-count'))).toEqual(before.count);
          expect(screenPositionOf(anchor('reticle'))).toEqual(before.reticle);
          expectAt(screenPositionOf(anchor('reticle')), nose, 0.5);
          expect(isShown(chrome('acquire-ring'))).toBe(true);
          expect(isShown(chrome('cue'))).toBe(true);
          expect(isShown(chrome('missile-count'))).toBe(true);
          const aim = indicator.getAimScreen();
          expect(aim.visible).toBe(true);
          expect(aim.x).toBe(before.aim.x);
          expect(aim.y).toBe(before.aim.y);
        }
      );

      it('keeps the seeker choosing by the nose axis, not by the cross', () => {
        const pose = levelPose();
        const camera = eyeCamera(pose);
        const aim = noseAxisPixel(pose, camera);
        // 一架离机头轴线 12 像素，另一架在 22 像素外；十字被拉到后者身上
        const nearNose = enemyAtPixel(camera, aim.x + 12, aim.y);
        const nearCross = enemyAtPixel(camera, aim.x - 22, aim.y);
        const offset = nearCross.position.clone().sub(pose.position);

        for (let i = 0; i < 30; i += 1) {
          indicator.update(pose.position, [nearCross, nearNose], camera, DT, pose.quaternion);
          renderAssisted(pose, camera, offset.clone().normalize(), offset.length());
          nowMs += DT * 1000;
        }

        expectAt(screenPositionOf(chrome('gun-cross')), { x: aim.x - 22, y: aim.y }, 0.5);
        expect(indicator.getSeeker().getTarget()).toBe(nearNose);
      });
    });

    describe('when the direction cannot be shown', () => {
      it('hides the cross when the assisted direction is behind the camera', () => {
        const pose = levelPose();
        const camera = eyeCamera(pose);
        const backwards = new THREE.Vector3(0, 0, 1).applyQuaternion(pose.quaternion);

        renderAssisted(pose, camera, backwards, 300);

        expect(isShown(chrome('gun-cross'))).toBe(false);
        expect(indicator.getGunCrossScreen().visible).toBe(false);
        expect(gunAssistFlag()).toBe('false');
        expect(indicator.isGunCrossAssisted()).toBe(false);
        // 机头轴线上的环照常显示
        expect(isShown(chrome('acquire-ring'))).toBe(true);
      });

      it('shows it again on the next frame with a direction in view', () => {
        const pose = levelPose();
        const camera = eyeCamera(pose);
        renderAssisted(pose, camera, new THREE.Vector3(0, 0, 1), 300);
        expect(isShown(chrome('gun-cross'))).toBe(false);

        const direction = offNose(pose, 2, 1);
        renderAssisted(pose, camera, direction, 300);

        expect(isShown(chrome('gun-cross'))).toBe(true);
        expectAt(screenPositionOf(chrome('gun-cross')), aimedPixel(pose, camera, direction, 300));
      });

      it.each([
        ['NaN', new THREE.Vector3(Number.NaN, 0, -1)],
        ['Infinity', new THREE.Vector3(0, Number.POSITIVE_INFINITY, -1)],
        ['-Infinity', new THREE.Vector3(0, 0, Number.NEGATIVE_INFINITY)],
      ])('falls back to the nose axis for a direction containing %s', (_name, direction) => {
        const pose = bankedPose();
        const camera = chaseCamera(pose);

        renderAssisted(pose, camera, direction, 300);

        const nose = noseAxisPixel(pose, camera);
        expect(isShown(chrome('gun-cross'))).toBe(true);
        expectAt(screenPositionOf(chrome('gun-cross')), nose, 0.5);
        const reported = indicator.getGunCrossScreen();
        expect(reported.visible).toBe(true);
        expectAt(reported, nose, 0.01);
        expect(gunAssistFlag()).toBe('false');
      });

      it('reports no cross while the indicator is not visible', () => {
        const pose = levelPose();
        const camera = eyeCamera(pose);
        renderAssisted(pose, camera, offNose(pose, 2, 1), 300);
        expect(indicator.getGunCrossScreen().visible).toBe(true);

        indicator.renderUpdate(
          false,
          pose.position,
          pose.quaternion,
          camera,
          null,
          false,
          offNose(pose, 2, 1),
          300
        );

        expect(indicator.getGunCrossScreen().visible).toBe(false);
        expect(indicator.isGunCrossAssisted()).toBe(false);
        expect(isShown(chrome('gun-cross'))).toBe(false);
      });
    });
  });
});
