import * as THREE from 'three';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_CONSTANTS } from '@/config';
import { CockpitModel } from '@/features/camera/CockpitModel';

/**
 * 第一人称座舱的几何（规格 C2 / C3），量的是真实的 CockpitModel 网格：
 * 眼点在座舱原点（eyeOffset = 0 时网格坐标就是眼点坐标），看向 -Z。
 *
 * C2 视野开阔：
 * - 中线上（x = 0 的竖直面内）没有不透明的东西高过视轴下方 18°（遮光罩上沿约 -19°）；
 * - 视轴周围 12° 以内没有任何不透明几何；
 * - 没有顶点近到会被相机近裁剪面切掉（实现方报告最近 0.52 米）。
 * C3 组合玻璃：名为 cockpit-combiner-glass 的网格，中心约 (0, -0.006, -0.6)，约 0.30 × 0.30 米，
 * 透明、低不透明度；基础视场下，屏幕中心半径为屏幕短边 13% 的导引头圆环整个落在玻璃里。
 */

const NEAR = GAME_CONSTANTS.CAMERA.NEAR;
const BASE_FOV = GAME_CONSTANTS.CAMERA.FOV;
const BORESIGHT = new THREE.Vector3(0, 0, -1);
const EYE = new THREE.Vector3();
const deg = THREE.MathUtils.radToDeg;
const rad = THREE.MathUtils.degToRad;

type Triangle = [THREE.Vector3, THREE.Vector3, THREE.Vector3];

interface MeshTriangles {
  mesh: THREE.Mesh;
  opaque: boolean;
  triangles: Triangle[];
}

function isOpaque(mesh: THREE.Mesh): boolean {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.some((material) => material.visible && !material.transparent);
}

/** 网格的全部三角形，换到眼点坐标 */
function trianglesOf(mesh: THREE.Mesh): Triangle[] {
  const position = mesh.geometry.getAttribute('position');
  const index = mesh.geometry.getIndex();
  const count = index ? index.count : position.count;
  const vertex = (i: number): THREE.Vector3 =>
    new THREE.Vector3()
      .fromBufferAttribute(position, index ? index.getX(i) : i)
      .applyMatrix4(mesh.matrixWorld);
  const triangles: Triangle[] = [];
  for (let i = 0; i + 2 < count; i += 3) {
    triangles.push([vertex(i), vertex(i + 1), vertex(i + 2)]);
  }
  return triangles;
}

/** 点偏离视轴的角度（度） */
function offBoresight(point: THREE.Vector3): number {
  return deg(point.angleTo(BORESIGHT));
}

/** 线段上离视轴最近的方向与视轴的夹角（度）：沿线段细分取最小 */
function segmentOffBoresight(a: THREE.Vector3, b: THREE.Vector3, samples = 48): number {
  const point = new THREE.Vector3();
  let min = Infinity;
  for (let i = 0; i <= samples; i++) {
    point.lerpVectors(a, b, i / samples);
    if (point.lengthSq() > 1e-12) min = Math.min(min, offBoresight(point));
  }
  return min;
}

/** 三角形与竖直中面（x = 0）的交线段（没有交则为 null） */
function centreLineCut(triangle: Triangle): [THREE.Vector3, THREE.Vector3] | null {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < 3; i++) {
    const a = triangle[i];
    const b = triangle[(i + 1) % 3];
    if (a.x === 0) points.push(a.clone());
    if ((a.x < 0 && b.x > 0) || (a.x > 0 && b.x < 0)) {
      points.push(new THREE.Vector3().lerpVectors(a, b, a.x / (a.x - b.x)));
    }
  }
  if (points.length < 2) return null;
  return [points[0], points[points.length - 1]];
}

/** 眼点前方（z < 0）的线段部分 */
function clipAhead(
  a: THREE.Vector3,
  b: THREE.Vector3,
  minDepth = 1e-4
): [THREE.Vector3, THREE.Vector3] | null {
  const ahead = (p: THREE.Vector3): boolean => -p.z > minDepth;
  if (!ahead(a) && !ahead(b)) return null;
  if (ahead(a) && ahead(b)) return [a, b];
  const t = (-minDepth - a.z) / (b.z - a.z);
  const cut = new THREE.Vector3().lerpVectors(a, b, t);
  return ahead(a) ? [a, cut] : [cut, b];
}

describe('CockpitModel geometry seen from the eye point', () => {
  let cockpit: CockpitModel;
  let meshes: MeshTriangles[];

  beforeAll(() => {
    // 无 canvas 环境：座舱仪表贴图走回退
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  function collect(): MeshTriangles[] {
    cockpit.root.updateMatrixWorld(true);
    const found: MeshTriangles[] = [];
    cockpit.root.traverse((object) => {
      if (object instanceof THREE.Mesh && object.visible) {
        found.push({ mesh: object, opaque: isOpaque(object), triangles: trianglesOf(object) });
      }
    });
    return found;
  }

  beforeEach(() => {
    cockpit = new CockpitModel(new THREE.Vector3());
    cockpit.setVisible(true);
    meshes = collect();
  });

  afterEach(() => {
    cockpit.dispose();
  });

  const opaqueTriangles = (): Triangle[] =>
    meshes.filter((entry) => entry.opaque).flatMap((entry) => entry.triangles);
  const allVertices = (): THREE.Vector3[] =>
    meshes.flatMap((entry) => entry.triangles.flatMap((triangle) => triangle));

  /** 中线上不透明几何的最高仰角（度；视轴为 0，向下为负） */
  function centreLineTop(triangles: Triangle[]): number {
    let top = -Infinity;
    for (const triangle of triangles) {
      const cut = centreLineCut(triangle);
      if (!cut) continue;
      const ahead = clipAhead(cut[0], cut[1]);
      if (!ahead) continue;
      for (const point of ahead) {
        top = Math.max(top, deg(Math.atan2(point.y, -point.z)));
      }
    }
    return top;
  }

  /** 不透明几何离视轴最近处的夹角（度）；视轴穿过某个三角形时为 0 */
  function clearanceAroundBoresight(triangles: Triangle[]): number {
    const ray = new THREE.Ray(EYE.clone(), BORESIGHT.clone());
    const hit = new THREE.Vector3();
    let min = Infinity;
    for (const [a, b, c] of triangles) {
      if (ray.intersectTriangle(a, b, c, false, hit)) return 0;
      min = Math.min(
        min,
        segmentOffBoresight(a, b),
        segmentOffBoresight(b, c),
        segmentOffBoresight(c, a)
      );
    }
    return min;
  }

  it('is made of real meshes, opaque structure and transparent glass', () => {
    expect(meshes.length).toBeGreaterThan(5);
    expect(opaqueTriangles().length).toBeGreaterThan(200);
    expect(meshes.some((entry) => !entry.opaque)).toBe(true);
    for (const vertex of allVertices()) {
      expect(Number.isFinite(vertex.x + vertex.y + vertex.z)).toBe(true);
    }
  });

  // ───────────────────────────── C2：视野开阔 ─────────────────────────────

  describe('openness (C2)', () => {
    it('has nothing opaque above 18° below the boresight on the centre line', () => {
      const top = centreLineTop(opaqueTriangles());
      expect(top, 'highest opaque point on the centre line (degrees)').toBeLessThanOrEqual(-18);
      // 遮光罩上沿约在 -19°：座舱没有被整个挪走
      expect(top).toBeGreaterThan(-20.5);
      expect(top).toBeCloseTo(-19, 0);
    });

    it('keeps the glare shield as the highest thing ahead on the centre line', () => {
      const glare = meshes.find((entry) => entry.mesh.name === 'cockpit-glare');
      expect(glare, 'cockpit-glare mesh').toBeTruthy();
      const glareTop = centreLineTop((glare as MeshTriangles).triangles);
      expect(glareTop).toBeCloseTo(centreLineTop(opaqueTriangles()), 6);
    });

    it('has no opaque geometry within 12° of the boresight', () => {
      const clearance = clearanceAroundBoresight(opaqueTriangles());
      expect(
        clearance,
        'closest opaque geometry to the boresight (degrees)'
      ).toBeGreaterThanOrEqual(12);
      // 不是空的断言：最近的不透明几何就在十几度开外
      expect(clearance).toBeLessThan(20);
    });

    it('keeps every opaque mesh out of the 12° cone, one by one', () => {
      for (const entry of meshes.filter((candidate) => candidate.opaque)) {
        expect(
          clearanceAroundBoresight(entry.triangles),
          `${entry.mesh.name || entry.mesh.type} (degrees off the boresight)`
        ).toBeGreaterThanOrEqual(12);
      }
    });

    it('still clears the view while the instruments animate', () => {
      cockpit.root.updateMatrixWorld(true);
      const attitudes = [
        new THREE.Quaternion(),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(80), 0, 0)),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(-80), 0, 0)),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(30), rad(120), rad(170))),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rad(-95))),
      ];
      for (const attitude of attitudes) {
        for (let i = 0; i < 40; i++) cockpit.update(0.1, attitude, 1, true, 1);
        const opaque = collect()
          .filter((entry) => entry.opaque)
          .flatMap((entry) => entry.triangles);
        expect(clearanceAroundBoresight(opaque)).toBeGreaterThanOrEqual(12);
        expect(centreLineTop(opaque)).toBeLessThanOrEqual(-18);
      }
    });

    it('has no vertex closer to the eye than the camera near plane', () => {
      const distances = allVertices().map((vertex) => vertex.length());
      const nearest = Math.min(...distances);
      expect(nearest, 'nearest vertex to the eye (m)').toBeGreaterThan(NEAR);
    });

    it('has its nearest vertex about 0.52 m from the eye', () => {
      const nearest = Math.min(...allVertices().map((vertex) => vertex.length()));
      expect(Math.abs(nearest - 0.52)).toBeLessThan(0.03);
    });

    it.each([
      ['landscape 21:9 at full kick', 84, 21 / 9],
      ['landscape 16:9 at base', BASE_FOV, 16 / 9],
      ['portrait 3:4', 86.07, 0.75],
      ['tall portrait at the 95° cap', 95, 9 / 19.5],
    ] as const)('clips nothing against the near plane in view (%s)', (_name, fov, aspect) => {
      const halfTanY = Math.tan(rad(fov / 2));
      const halfTanX = halfTanY * aspect;
      let seen = 0;
      for (const vertex of allVertices()) {
        const depth = -vertex.z;
        if (depth <= 0) continue;
        const inView =
          Math.abs(vertex.x) <= depth * halfTanX && Math.abs(vertex.y) <= depth * halfTanY;
        if (!inView) continue;
        seen++;
        expect(depth).toBeGreaterThan(NEAR);
      }
      expect(seen, 'some of the cockpit is in view').toBeGreaterThan(0);
    });
  });

  // ───────────────────────────── C3：组合玻璃 ─────────────────────────────

  describe('combiner glass (C3)', () => {
    function glass(): THREE.Mesh {
      const found = meshes.filter((entry) => entry.mesh.name === 'cockpit-combiner-glass');
      expect(found, 'one mesh named cockpit-combiner-glass').toHaveLength(1);
      return found[0].mesh;
    }

    function glassVertices(): THREE.Vector3[] {
      const mesh = glass();
      const position = mesh.geometry.getAttribute('position');
      const vertices: THREE.Vector3[] = [];
      for (let i = 0; i < position.count; i++) {
        vertices.push(
          new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld)
        );
      }
      return vertices;
    }

    /** 屏幕中心、半径为屏幕短边 fraction 倍的圆环上的视线（基础视场，横屏：短边是屏幕高） */
    function ringRays(fraction: number, count = 96): THREE.Ray[] {
      // 屏幕高的一半对应 tan(fov / 2)，所以半径 fraction × 高 对应 2 × fraction × tan(fov / 2)
      const tanRadius = 2 * fraction * Math.tan(rad(BASE_FOV / 2));
      const rays: THREE.Ray[] = [];
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const direction = new THREE.Vector3(
          Math.cos(angle) * tanRadius,
          Math.sin(angle) * tanRadius,
          -1
        ).normalize();
        rays.push(new THREE.Ray(EYE.clone(), direction));
      }
      return rays;
    }

    function hitsGlass(ray: THREE.Ray): boolean {
      const raycaster = new THREE.Raycaster(ray.origin, ray.direction, 0, 10);
      return raycaster.intersectObject(glass(), false).length > 0;
    }

    it('is centred about (0, -0.006, -0.6)', () => {
      const box = new THREE.Box3().setFromPoints(glassVertices());
      const centre = box.getCenter(new THREE.Vector3());
      expect(centre.x).toBeCloseTo(0, 2);
      expect(Math.abs(centre.y - -0.006)).toBeLessThan(0.01);
      expect(Math.abs(centre.z - -0.6)).toBeLessThan(0.01);
    });

    it('is about 0.30 m wide and 0.30 m tall', () => {
      const box = new THREE.Box3().setFromPoints(glassVertices());
      const size = box.getSize(new THREE.Vector3());
      // 玻璃后仰：高度沿玻璃面量（竖直与前后两个方向的合成）
      const width = size.x;
      const height = Math.hypot(size.y, size.z);
      expect(Math.abs(width - 0.3)).toBeLessThan(0.02);
      expect(Math.abs(height - 0.3)).toBeLessThan(0.02);
      // 是一片薄玻璃：四个角共面
      const vertices = glassVertices();
      const plane = new THREE.Plane().setFromCoplanarPoints(vertices[0], vertices[1], vertices[2]);
      for (const vertex of vertices) {
        expect(Math.abs(plane.distanceToPoint(vertex))).toBeLessThan(1e-4);
      }
    });

    it('is transparent with a low opacity', () => {
      const material = glass().material as THREE.Material;
      expect(Array.isArray(material)).toBe(false);
      expect(material.transparent).toBe(true);
      expect(material.opacity).toBeGreaterThan(0);
      expect(material.opacity).toBeLessThanOrEqual(0.2);
      // 不遮挡后面的景物
      expect(material.depthWrite).toBe(false);
    });

    it('sits on the boresight', () => {
      expect(hitsGlass(new THREE.Ray(EYE.clone(), BORESIGHT.clone()))).toBe(true);
    });

    it('holds a seeker ring of 13% of the short screen side at screen centre, at the base FOV', () => {
      for (const fraction of [0.13, 0.1, 0.06, 0.02]) {
        const rays = ringRays(fraction);
        const missed = rays.filter((ray) => !hitsGlass(ray)).length;
        expect(missed, `ring of ${fraction * 100}% of the short side: rays missing the glass`).toBe(
          0
        );
      }
    });

    it('is not much larger than it needs to be (a ring twice that size does not fit)', () => {
      const rays = ringRays(0.26);
      expect(rays.filter((ray) => !hitsGlass(ray)).length).toBeGreaterThan(0);
    });

    it('holds the same ring on a portrait screen, where the short side is the width', () => {
      // 竖屏的水平视场不超过横屏基础视场下的竖直视场，圆环只会更小；按 70° 水平视场验证
      const tanRadius = 2 * 0.13 * Math.tan(rad(70 / 2));
      for (let i = 0; i < 96; i++) {
        const angle = (i / 96) * Math.PI * 2;
        const direction = new THREE.Vector3(
          Math.cos(angle) * tanRadius,
          Math.sin(angle) * tanRadius,
          -1
        ).normalize();
        expect(hitsGlass(new THREE.Ray(EYE.clone(), direction))).toBe(true);
      }
    });

    it('has no opaque geometry in front of or behind the ring', () => {
      const opaque = meshes.filter((entry) => entry.opaque).map((entry) => entry.mesh);
      const raycaster = new THREE.Raycaster();
      for (const ray of [new THREE.Ray(EYE.clone(), BORESIGHT.clone()), ...ringRays(0.13)]) {
        raycaster.set(ray.origin, ray.direction);
        expect(raycaster.intersectObjects(opaque, false)).toHaveLength(0);
      }
    });
  });
});
