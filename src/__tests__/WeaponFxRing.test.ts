import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WeaponFx } from '@/features/weapons/WeaponFx';
import { createShockRing } from '@/features/weapons/WeaponFxShaders';

/**
 * EMP 闪白修复（终验修复第 2 波 G2）：WeaponFx.spawnRing(..., additive, nearFade) 在 nearFade > 0 时
 * 让冲击环贴近镜头的部分淡出（nearFade = 0 时与以前一样）；EMP 的两道冲击环都带近距淡出。
 * 淡出本身在着色器里（jsdom 跑不了 GLSL）：这里检查环的 uNearFade 设置与着色器的门控条件。
 */

function nearFadeRings(scene: THREE.Scene): THREE.Mesh[] {
  const rings: THREE.Mesh[] = [];
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const material = object.material as THREE.ShaderMaterial;
    if (material instanceof THREE.ShaderMaterial && 'uNearFade' in material.uniforms) {
      rings.push(object);
    }
  });
  return rings;
}

function nearFadeOf(ring: THREE.Mesh): number {
  return (ring.material as THREE.ShaderMaterial).uniforms.uNearFade.value as number;
}

describe('WeaponFx shock rings: near-camera fade', () => {
  let scene: THREE.Scene;
  let fx: WeaponFx;
  let canvasSpy: { mockRestore(): void } | null = null;

  beforeEach(() => {
    canvasSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
    scene = new THREE.Scene();
    fx = new WeaponFx(scene);
    fx.attach();
  });

  afterEach(() => {
    fx.dispose();
    canvasSpy?.mockRestore();
    canvasSpy = null;
  });

  function visibleRings(): THREE.Mesh[] {
    return nearFadeRings(scene).filter((ring) => ring.visible);
  }

  function spawn(nearFade?: number): THREE.Mesh {
    const before = new Set(visibleRings());
    const args = [
      new THREE.Vector3(0, 100, 0),
      new THREE.Vector3(0, 1, 0),
      1,
      40,
      0.8,
      new THREE.Color(0x66ccff),
      0.6,
      0.06,
      true,
    ] as const;
    if (nearFade === undefined) {
      fx.spawnRing(...args);
    } else {
      fx.spawnRing(...args, nearFade);
    }
    const spawned = visibleRings().filter((ring) => !before.has(ring));
    expect(spawned).toHaveLength(1);
    return spawned[0];
  }

  it('the ring pool has a near-fade setting', () => {
    expect(nearFadeRings(scene).length).toBeGreaterThan(0);
    for (const ring of nearFadeRings(scene)) expect(nearFadeOf(ring)).toBe(0);
  });

  it('a ring spawned with nearFade > 0 fades within that distance of the camera', () => {
    expect(nearFadeOf(spawn(48))).toBe(48);
    expect(nearFadeOf(spawn(12.5))).toBe(12.5);
  });

  it('without nearFade (or with 0) the ring is unchanged: no fade, even on a reused ring', () => {
    const faded = spawn(48);
    expect(nearFadeOf(faded)).toBe(48);
    fx.update(5);
    expect(faded.visible, 'expired').toBe(false);

    // 池里的环会被复用：上一次的近距淡出不能残留
    const rings = nearFadeRings(scene).length;
    for (let i = 0; i < rings; i++) {
      expect(nearFadeOf(spawn())).toBe(0);
    }
    fx.update(5);
    expect(nearFadeOf(spawn(0))).toBe(0);
  });

  it.each([-5, Number.NaN, -Infinity])('treats a nearFade of %s as no fade', (nearFade) => {
    expect(nearFadeOf(spawn(nearFade))).toBe(0);
  });

  it('the EMP blast spawns its shock rings with a near-camera fade', () => {
    const before = new Set(visibleRings());
    fx.fireEmp(new THREE.Vector3(10, 150, -20), 140);
    const rings = visibleRings().filter((ring) => !before.has(ring));
    expect(rings.length).toBeGreaterThanOrEqual(2);
    for (const ring of rings) expect(nearFadeOf(ring)).toBeGreaterThan(0);
  });

  it('the ring shader fades by view distance only when uNearFade > 0', () => {
    const ring = createShockRing(new THREE.CircleGeometry(1, 8));
    try {
      const { vertexShader, fragmentShader } = ring.material;
      expect(vertexShader).toMatch(/vViewDistance\s*=\s*length\(/);
      expect(fragmentShader).toMatch(/uniform\s+float\s+uNearFade/);
      expect(fragmentShader).toMatch(
        /if\s*\(\s*uNearFade\s*>\s*0\.0\s*\)[^;]*smoothstep\([^;]*uNearFade[^;]*vViewDistance/
      );
    } finally {
      ring.material.dispose();
      ring.mesh.geometry.dispose();
    }
  });
});
