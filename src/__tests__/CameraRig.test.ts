import * as THREE from 'three';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CameraRig,
  PLAYER_EXTERIOR_LAYER,
  type CameraMode,
  type CameraRigFlightState,
} from '@/features/camera/CameraRig';
import { ThirdPersonCamera } from '@/features/camera/ThirdPersonCamera';

const DT = 1 / 60;
const CRUISE: CameraRigFlightState = { speedRatio: 0.5, boosting: false };

interface Fixture {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  target: THREE.Group;
}

function createFixture(): Fixture {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 5000);
  const target = new THREE.Group();
  target.add(new THREE.Mesh(new THREE.BoxGeometry(2, 1, 6), new THREE.MeshBasicMaterial()));
  target.position.set(10, 120, -40);
  scene.add(target);
  return { scene, camera, target };
}

function step(rig: CameraRig, target: THREE.Object3D, seconds: number, dt = DT): void {
  const frames = Math.round(seconds / dt);
  for (let i = 0; i < frames; i++) {
    rig.update(target.position, target.quaternion, dt, CRUISE);
  }
}

function isFiniteCamera(camera: THREE.PerspectiveCamera): boolean {
  const { position: p, quaternion: q } = camera;
  return [p.x, p.y, p.z, q.x, q.y, q.z, q.w, camera.fov].every(Number.isFinite);
}

describe('CameraRig', () => {
  let fixture: Fixture;
  let rig: CameraRig;

  beforeAll(() => {
    // 无 canvas 环境：座舱仪表贴图必须回退
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    fixture = createFixture();
    rig = new CameraRig(fixture.camera, fixture.target);
  });

  afterEach(() => {
    rig.dispose();
  });

  describe('modes', () => {
    it('defaults to third-person', () => {
      expect(rig.getMode()).toBe('third-person');
      expect(rig.isFirstPerson()).toBe(false);
    });

    it('honours the starting mode option', () => {
      const firstPerson = new CameraRig(fixture.camera, fixture.target, { mode: 'first-person' });
      expect(firstPerson.getMode()).toBe('first-person');
      expect(firstPerson.isFirstPerson()).toBe(true);
      firstPerson.dispose();
    });

    it('setMode switches the mode and reports real changes once', () => {
      const onModeChanged = vi.fn();
      rig.onModeChanged = onModeChanged;

      rig.setMode('first-person');
      expect(rig.getMode()).toBe('first-person');
      expect(rig.isFirstPerson()).toBe(true);
      expect(onModeChanged).toHaveBeenCalledTimes(1);
      expect(onModeChanged).toHaveBeenLastCalledWith('first-person');

      rig.setMode('first-person');
      expect(onModeChanged).toHaveBeenCalledTimes(1);

      rig.setMode('third-person', true);
      expect(rig.isFirstPerson()).toBe(false);
      expect(onModeChanged).toHaveBeenCalledTimes(2);
      expect(onModeChanged).toHaveBeenLastCalledWith('third-person');
    });

    it('toggleMode flips the mode, returns it and notifies', () => {
      const onModeChanged = vi.fn();
      rig.onModeChanged = onModeChanged;

      expect(rig.toggleMode()).toBe('first-person');
      expect(rig.getMode()).toBe('first-person');
      expect(rig.toggleMode()).toBe('third-person');
      expect(rig.getMode()).toBe('third-person');
      expect(onModeChanged.mock.calls.map((call) => call[0])).toEqual([
        'first-person',
        'third-person',
      ]);
    });

    it('ignores an unknown mode', () => {
      const onModeChanged = vi.fn();
      rig.onModeChanged = onModeChanged;
      rig.setMode('cinematic' as unknown as CameraMode);
      expect(rig.getMode()).toBe('third-person');
      expect(onModeChanged).not.toHaveBeenCalled();
    });
  });

  describe('player exterior layer', () => {
    it('is layer 3', () => {
      expect(PLAYER_EXTERIOR_LAYER).toBe(3);
    });

    it('tags the player aircraft, including children added later', () => {
      expect(fixture.target.layers.isEnabled(PLAYER_EXTERIOR_LAYER)).toBe(true);
      fixture.target.children.forEach((child) => {
        expect(child.layers.isEnabled(PLAYER_EXTERIOR_LAYER)).toBe(true);
      });

      const pod = new THREE.Object3D();
      fixture.target.add(pod);
      step(rig, fixture.target, DT);
      expect(pod.layers.isEnabled(PLAYER_EXTERIOR_LAYER)).toBe(true);
    });

    it('the camera sees the exterior in third person and hides it in first person', () => {
      step(rig, fixture.target, 0.1);
      expect(fixture.camera.layers.isEnabled(PLAYER_EXTERIOR_LAYER)).toBe(true);

      rig.setMode('first-person', true);
      expect(fixture.camera.layers.isEnabled(PLAYER_EXTERIOR_LAYER)).toBe(false);

      rig.setMode('third-person', true);
      expect(fixture.camera.layers.isEnabled(PLAYER_EXTERIOR_LAYER)).toBe(true);
    });

    it('hides the exterior once a blended switch to first person completes', () => {
      step(rig, fixture.target, 0.1);
      rig.setMode('first-person');
      step(rig, fixture.target, 1);
      expect(fixture.camera.layers.isEnabled(PLAYER_EXTERIOR_LAYER)).toBe(false);

      rig.setMode('third-person');
      step(rig, fixture.target, 1);
      expect(fixture.camera.layers.isEnabled(PLAYER_EXTERIOR_LAYER)).toBe(true);
    });

    it('a first-person rig starts with the exterior hidden', () => {
      const camera = new THREE.PerspectiveCamera();
      const firstPerson = new CameraRig(camera, fixture.target, { mode: 'first-person' });
      expect(camera.layers.isEnabled(PLAYER_EXTERIOR_LAYER)).toBe(false);
      firstPerson.dispose();
    });

    it('dispose() makes the exterior visible again', () => {
      rig.setMode('first-person', true);
      rig.dispose();
      expect(fixture.camera.layers.isEnabled(PLAYER_EXTERIOR_LAYER)).toBe(true);
      expect(fixture.target.layers.isEnabled(0)).toBe(true);
    });
  });

  describe('placement', () => {
    it('chases from behind in third person and sits at the eye point in first person', () => {
      step(rig, fixture.target, 0.5);
      const chaseDistance = fixture.camera.position.distanceTo(fixture.target.position);
      expect(chaseDistance).toBeGreaterThan(8);
      // 机头朝 -Z：追尾相机在机体后方（+Z）
      expect(fixture.camera.position.z).toBeGreaterThan(fixture.target.position.z);

      rig.setMode('first-person', true);
      step(rig, fixture.target, DT);
      expect(fixture.camera.position.distanceTo(fixture.target.position)).toBeLessThan(2);
    });
  });

  describe('shake', () => {
    it('accumulates trauma up to 1 and decays to 0', () => {
      rig.addShake(0.3);
      rig.addShake(0.3);
      expect(rig.getShake()).toBeCloseTo(0.6, 6);
      rig.addShake(5);
      expect(rig.getShake()).toBe(1);

      step(rig, fixture.target, 0.3);
      const decaying = rig.getShake();
      expect(decaying).toBeGreaterThan(0);
      expect(decaying).toBeLessThan(1);

      step(rig, fixture.target, 2);
      expect(rig.getShake()).toBe(0);
    });

    it('ignores non-positive and non-finite intensities', () => {
      rig.addShake(-1);
      rig.addShake(Number.NaN);
      rig.addShake(Infinity);
      expect(rig.getShake()).toBe(0);
    });

    it('jolts the camera while trauma lasts and settles afterwards', () => {
      const calm = createFixture();
      const calmRig = new CameraRig(calm.camera, calm.target);
      calm.target.position.copy(fixture.target.position);
      step(rig, fixture.target, 0.2);
      step(calmRig, calm.target, 0.2);

      rig.addShake(1);
      step(rig, fixture.target, 0.1);
      step(calmRig, calm.target, 0.1);
      expect(fixture.camera.position.distanceTo(calm.camera.position)).toBeGreaterThan(1e-3);

      step(rig, fixture.target, 2);
      step(calmRig, calm.target, 2);
      expect(fixture.camera.position.distanceTo(calm.camera.position)).toBeLessThan(1e-6);
      calmRig.dispose();
    });
  });

  describe('robustness', () => {
    it('keeps the camera finite when fed NaN, Infinity or a zero quaternion', () => {
      step(rig, fixture.target, 0.2);
      const before = fixture.camera.position.clone();

      rig.update(new THREE.Vector3(Number.NaN, 0, 0), fixture.target.quaternion, DT, CRUISE);
      rig.update(fixture.target.position, new THREE.Quaternion(Number.NaN, 0, 0, 1), DT, CRUISE);
      rig.update(new THREE.Vector3(Infinity, 0, 0), fixture.target.quaternion, DT, CRUISE);
      rig.update(fixture.target.position, new THREE.Quaternion(0, 0, 0, 0), DT, CRUISE);
      expect(isFiniteCamera(fixture.camera)).toBe(true);
      expect(fixture.camera.position.equals(before)).toBe(true);

      rig.update(fixture.target.position, fixture.target.quaternion, Number.NaN, {
        speedRatio: Number.NaN,
        boosting: true,
      });
      rig.update(fixture.target.position, fixture.target.quaternion, -1);
      rig.update(fixture.target.position, fixture.target.quaternion, Infinity);
      expect(isFiniteCamera(fixture.camera)).toBe(true);
    });

    it('stays finite through a loop and both mode switches', () => {
      const axis = new THREE.Vector3(1, 0, 0);
      for (let i = 0; i < 240; i++) {
        fixture.target.quaternion.setFromAxisAngle(axis, (i / 240) * Math.PI * 2);
        fixture.target.position.addScaledVector(
          new THREE.Vector3(0, 0, -1).applyQuaternion(fixture.target.quaternion),
          1
        );
        if (i === 60) rig.toggleMode();
        if (i === 150) rig.toggleMode();
        rig.update(fixture.target.position, fixture.target.quaternion, DT, {
          speedRatio: (i % 60) / 60,
          boosting: i % 2 === 0,
        });
        expect(isFiniteCamera(fixture.camera), `frame ${i}`).toBe(true);
      }
    });

    it('dispose() is idempotent and later updates are ignored', () => {
      step(rig, fixture.target, 0.1);
      rig.dispose();
      const frozen = fixture.camera.position.clone();
      expect(() => rig.dispose()).not.toThrow();
      rig.update(new THREE.Vector3(500, 500, 500), fixture.target.quaternion, DT);
      expect(fixture.camera.position.equals(frozen)).toBe(true);
    });
  });
});

describe('ThirdPersonCamera (back-compat export)', () => {
  it('is still exported and still follows its target', () => {
    const camera = new THREE.PerspectiveCamera();
    const target = new THREE.Object3D();
    target.position.set(0, 50, 0);
    const chase = new ThirdPersonCamera(camera, target);
    chase.update();
    expect(camera.position.distanceTo(target.position)).toBeGreaterThan(1);
    expect(isFiniteCamera(camera)).toBe(true);
  });
});
