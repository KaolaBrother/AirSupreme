import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BossConfig } from './BossTypes';
import { createGlowMaterial, createGlowSprite } from './MagmaColossusHazards';
import { createPhaseShimmerMaterial, type PhaseShimmerMaterial } from './PhantomWingFx';

/**
 * 第九关 Boss「幻影之翼」模型：带锯齿后缘的隐形飞翼。
 *
 * 朝向：机头 +Z，上方向 +Y；根节点原点位于机体中心。
 * - 机体：锯齿后缘飞翼（厚度由翼根向翼尖收薄）+ 中央座舱隆起 + 两道发动机隆起，
 *   近黑紫的吸波涂层（顶点色拼板），青色发光接缝勾勒前缘。
 * - 红色传感器狭缝（“眼”）、机头下方品红色棱镜（激光长矛发射器，充能时为弱点）。
 * - 背部两道红色尾喷口（真身尾焰为红色；诱饵为青色）。
 * - 翼尖两枚紫色相位发射器（子目标：维持隐形场与全息诱饵）。
 * - 腹部导弹舱（两扇舱门，开舱时为弱点）。
 * - 相位闪烁外壳：隐形 / 现形时六边形网格扫过机体（着色器）。
 *
 * 尺寸以设计单位书写，乘以 config.scale（默认 5）得到米（翼展约 74 米）。
 */

export interface PhantomEmitterRig {
  index: number;
  side: 1 | -1;
  /** 子目标 / 碰撞部件 */
  pod: THREE.Mesh;
  lensMaterial: THREE.MeshStandardMaterial;
  glow: THREE.Sprite;
}

export interface PhantomEngineRig {
  index: number;
  side: 1 | -1;
  /** 碰撞部件：尾喷口 */
  nozzle: THREE.Mesh;
  flame: THREE.Mesh;
  glow: THREE.Sprite;
}

export interface PhantomWingMaterials {
  body: THREE.MeshStandardMaterial;
  seam: THREE.MeshStandardMaterial;
  eye: THREE.MeshStandardMaterial;
  prism: THREE.MeshStandardMaterial;
  nozzle: THREE.MeshStandardMaterial;
  flame: THREE.MeshBasicMaterial;
  pod: THREE.MeshStandardMaterial;
  bayInterior: THREE.MeshStandardMaterial;
  door: THREE.MeshStandardMaterial;
  shimmer: PhaseShimmerMaterial;
}

export interface PhantomWingRig {
  scale: number;
  /** 机体（中心碰撞部件） */
  body: THREE.Mesh;
  /** 共享给诱饵的几何体 */
  bodyGeometry: THREE.BufferGeometry;
  seamGeometry: THREE.BufferGeometry;
  nozzleGeometry: THREE.BufferGeometry;
  flameGeometry: THREE.BufferGeometry;
  shimmer: THREE.Mesh;
  /** 左右外翼碰撞锚点（不可见） */
  wingAnchors: THREE.Object3D[];
  prism: THREE.Mesh;
  prismGlow: THREE.Sprite;
  eye: THREE.Mesh;
  eyeGlow: THREE.Sprite;
  engines: PhantomEngineRig[];
  emitters: PhantomEmitterRig[];
  bayInterior: THREE.Mesh;
  bayDoors: THREE.Group[];
  /** 机炮口（翼根前缘） */
  muzzles: THREE.Object3D[];
  /** 光束起点（棱镜前方） */
  noseTip: THREE.Object3D;
  bayLaunch: THREE.Object3D;
  /** 隐形时需要淡出的材质（opacity 基准值） */
  fadeMaterials: Array<{ material: THREE.Material; base: number }>;
  halfSpan: number;
  length: number;
  materials: PhantomWingMaterials;
}

export type PhantomWingGroup = THREE.Group & { phantomRig?: PhantomWingRig };

/** 半边平面轮廓（x ≥ 0），设计单位：机头 → 前缘 → 翼尖 → 锯齿后缘 → 机尾中心 */
const HALF_OUTLINE: ReadonlyArray<readonly [number, number]> = [
  [0, 3.6],
  [7.4, -1.4],
  [7.2, -2.1],
  [5.0, -0.9],
  [3.4, -2.3],
  [1.7, -1.3],
  [0, -2.2],
];
const HALF_SPAN = 7.4;
const CENTER_HALF_THICKNESS = 0.55;

/** 翼面上表面高度（设计单位）：翼根厚、翼尖薄 */
export function phantomSurfaceY(x: number): number {
  const span = Math.min(1, Math.abs(x) / HALF_SPAN);
  return CENTER_HALF_THICKNESS * (1 - 0.82 * Math.pow(span, 0.85)) + 0.02;
}

function placed(
  geometry: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
  rx: number = 0,
  ry: number = 0,
  rz: number = 0,
  sx: number = 1,
  sy: number = 1,
  sz: number = 1
): THREE.BufferGeometry {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz)
  );
  const prepared = geometry.index ? geometry.toNonIndexed() : geometry;
  if (prepared !== geometry) geometry.dispose();
  prepared.applyMatrix4(matrix);
  return prepared;
}

function mergeAll(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(geometries, false) ?? new THREE.BufferGeometry();
  for (const geometry of geometries) geometry.dispose();
  return merged;
}

/** 两点之间的细杆（设计单位 → 米） */
function seamBar(
  a: THREE.Vector3,
  b: THREE.Vector3,
  width: number,
  height: number,
  s: number
): THREE.BufferGeometry {
  const direction = new THREE.Vector3().subVectors(b, a);
  const length = Math.max(1e-3, direction.length());
  const geometry = new THREE.BoxGeometry(width * s, height * s, length * s).toNonIndexed();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    direction.divideScalar(length)
  );
  const middle = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5 * s);
  geometry.applyMatrix4(
    new THREE.Matrix4().compose(middle, quaternion, new THREE.Vector3(1, 1, 1))
  );
  return geometry;
}

/** 飞翼机体：挤出平面轮廓 → 厚度收薄 → 合并座舱 / 发动机隆起 → 烘焙顶点色涂装 */
function createBodyGeometry(s: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(HALF_OUTLINE[0][0], HALF_OUTLINE[0][1]);
  for (let i = 1; i < HALF_OUTLINE.length; i++)
    shape.lineTo(HALF_OUTLINE[i][0], HALF_OUTLINE[i][1]);
  for (let i = HALF_OUTLINE.length - 2; i >= 1; i--) {
    shape.lineTo(-HALF_OUTLINE[i][0], HALF_OUTLINE[i][1]);
  }
  shape.lineTo(HALF_OUTLINE[0][0], HALF_OUTLINE[0][1]);
  const slab = new THREE.ExtrudeGeometry(shape, {
    depth: 0.5,
    bevelEnabled: true,
    bevelThickness: 0.42,
    bevelSize: 0.32,
    bevelSegments: 3,
    curveSegments: 4,
  });
  slab.translate(0, 0, -0.25);
  // 形状 (x, 弦向 y) → 世界 (x, 厚度, z)
  slab.rotateX(Math.PI / 2);
  const position = slab.getAttribute('position');
  const halfDepth = 0.25 + 0.42;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const thickness = phantomSurfaceY(x) - 0.02;
    position.setY(i, (y / halfDepth) * thickness);
  }
  const parts: THREE.BufferGeometry[] = [slab.index ? slab.toNonIndexed() : slab];
  if (parts[0] !== slab) slab.dispose();
  // 中央座舱隆起
  parts.push(placed(new THREE.SphereGeometry(1, 24, 12), 0, 0.12, 0.6, 0, 0, 0, 1.75, 0.78, 2.9));
  // 发动机隆起
  for (const side of [1, -1]) {
    parts.push(
      placed(new THREE.SphereGeometry(1, 16, 10), side * 1.5, 0.18, -0.35, 0, 0, 0, 0.72, 0.5, 1.9)
    );
  }
  const merged = mergeAll(parts);
  merged.scale(s, s, s);
  merged.computeVertexNormals();
  // 顶点色：近黑紫吸波涂层 + 前缘偏亮 + 锯齿状拼板
  const pos = merged.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color(0x232533);
  const dark = new THREE.Color(0x15161f);
  const edge = new THREE.Color(0x3a3a52);
  const violet = new THREE.Color(0x2c2340);
  const color = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / s;
    const z = pos.getZ(i) / s;
    const span = Math.min(1, Math.abs(x) / HALF_SPAN);
    color.copy(base).lerp(dark, span * 0.7);
    // 前缘：z 接近前缘线 z_le(x) = 3.6 - 5.0 * |x| / 7.4
    const leadingZ = 3.6 - (5.0 * Math.abs(x)) / HALF_SPAN;
    if (z > leadingZ - 0.6) color.lerp(edge, 0.55);
    // 锯齿拼板：沿翼展方向的斜条纹
    const stripe = Math.floor((z + Math.abs(x) * 0.68) / 1.15) % 2 === 0;
    if (stripe) color.lerp(violet, 0.35);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return merged;
}

/** 发光接缝：两道前缘线 + 机背脊线 + 锯齿后缘内侧线 */
function createSeamGeometry(s: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const top = (x: number): number => phantomSurfaceY(x) + 0.01;
  for (const side of [1, -1]) {
    // 前缘接缝（略向内）
    const a = new THREE.Vector3(side * 0.9, top(0.9) + 0.18, 2.75);
    const b = new THREE.Vector3(side * 6.9, top(6.9), -1.12);
    parts.push(seamBar(a, b, 0.09, 0.05, s));
    // 后缘锯齿内侧
    const saw: Array<[number, number]> = [
      [6.75, -1.85],
      [4.9, -0.72],
      [3.4, -1.95],
      [1.8, -1.05],
    ];
    for (let i = 0; i < saw.length - 1; i++) {
      const p = new THREE.Vector3(side * saw[i][0], top(saw[i][0]), saw[i][1]);
      const q = new THREE.Vector3(side * saw[i + 1][0], top(saw[i + 1][0]), saw[i + 1][1]);
      parts.push(seamBar(p, q, 0.06, 0.04, s));
    }
    // 发动机隆起两侧的短接缝
    parts.push(
      seamBar(
        new THREE.Vector3(side * 2.2, top(2.2) + 0.08, 0.9),
        new THREE.Vector3(side * 2.15, top(2.15) + 0.04, -1.6),
        0.06,
        0.05,
        s
      )
    );
  }
  // 机背脊线
  parts.push(
    seamBar(new THREE.Vector3(0, 0.92, 1.9), new THREE.Vector3(0, 0.72, -1.0), 0.08, 0.05, s)
  );
  return mergeAll(parts);
}

function createFadeMaterial(
  parameters: THREE.MeshStandardMaterialParameters
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ ...parameters, transparent: true, opacity: 1 });
}

export function createPhantomWingMaterials(s: number): PhantomWingMaterials {
  return {
    body: createFadeMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.42,
      metalness: 0.32,
      emissive: 0x160c2a,
      emissiveIntensity: 0.55,
    }),
    seam: createFadeMaterial({
      color: 0x062030,
      roughness: 0.3,
      metalness: 0.2,
      emissive: 0x5ae2ff,
      emissiveIntensity: 1.8,
    }),
    eye: createFadeMaterial({
      color: 0x300408,
      roughness: 0.2,
      metalness: 0.1,
      emissive: 0xff2a3a,
      emissiveIntensity: 2.6,
    }),
    prism: createFadeMaterial({
      color: 0x30061a,
      roughness: 0.1,
      metalness: 0.3,
      emissive: 0xff3a7a,
      emissiveIntensity: 1.4,
      flatShading: true,
    }),
    nozzle: createFadeMaterial({
      color: 0x2a0604,
      roughness: 0.3,
      metalness: 0.4,
      emissive: 0xff4a24,
      emissiveIntensity: 2.2,
    }),
    flame: createGlowMaterial(0xff4a2a, 0.75, { side: THREE.DoubleSide, vertexColors: true }),
    pod: createFadeMaterial({
      color: 0x1e2030,
      roughness: 0.4,
      metalness: 0.5,
      emissive: 0x100a20,
      emissiveIntensity: 0.5,
    }),
    bayInterior: createFadeMaterial({
      color: 0x2a0806,
      roughness: 0.5,
      metalness: 0.2,
      emissive: 0xff5a2a,
      emissiveIntensity: 0.2,
      side: THREE.DoubleSide,
    }),
    door: createFadeMaterial({
      color: 0x24263a,
      roughness: 0.45,
      metalness: 0.35,
      emissive: 0x120a22,
      emissiveIntensity: 0.5,
    }),
    shimmer: createPhaseShimmerMaterial(0x7ae0ff, 0xb48aff, 1.5 * s * 0.42),
  };
}

/** 尾焰锥：尖端朝 -Z，原点在喷口平面 */
function createFlameGeometry(s: number): THREE.BufferGeometry {
  const geometry = new THREE.ConeGeometry(0.42 * s, 3.2 * s, 10, 1, true);
  // 底面（宽、亮）在原点，尖端（暗）沿 +Y
  geometry.translate(0, 1.6 * s, 0);
  const pos = geometry.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp(pos.getY(i) / (3.2 * s), 0, 1);
    const c = Math.pow(1 - t, 1.4);
    colors[i * 3] = c;
    colors[i * 3 + 1] = c;
    colors[i * 3 + 2] = c;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // rotateX(-90°)：+Y → -Z（尖端朝后）
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/**
 * 创建幻影之翼模型。返回的 Group 名为 `BOSS_${config.type}`，
 * 可碰撞部件（userData.hitRadius，米）挂在 group.bossParts，骨架挂在 group.phantomRig。
 */
export function createPhantomWingMesh(config: BossConfig): THREE.Group {
  const s = Number.isFinite(config.scale) && config.scale > 0 ? config.scale : 5;
  const group = new THREE.Group() as PhantomWingGroup & { bossParts?: THREE.Object3D[] };
  group.name = `BOSS_${config.type}`;
  const materials = createPhantomWingMaterials(s);
  const parts: THREE.Object3D[] = [];
  const fadeMaterials: Array<{ material: THREE.Material; base: number }> = [];
  const trackFade = (material: THREE.Material): void => {
    if (!fadeMaterials.some((entry) => entry.material === material)) {
      fadeMaterials.push({ material, base: material.opacity });
    }
  };

  const bodyGeometry = createBodyGeometry(s);
  const body = new THREE.Mesh(bodyGeometry, materials.body);
  body.name = 'phantom_body';
  body.userData.hitRadius = 3.3 * s;
  group.add(body);
  parts.push(body);
  trackFade(materials.body);

  const shimmer = new THREE.Mesh(bodyGeometry, materials.shimmer);
  shimmer.name = 'phantom_phase_shimmer';
  shimmer.scale.setScalar(1.025);
  shimmer.renderOrder = 0;
  shimmer.visible = false;
  group.add(shimmer);

  const seamGeometry = createSeamGeometry(s);
  const seams = new THREE.Mesh(seamGeometry, materials.seam);
  seams.name = 'phantom_seams';
  group.add(seams);
  trackFade(materials.seam);

  // ===== 传感器狭缝 =====
  const eye = new THREE.Mesh(new THREE.BoxGeometry(1.5 * s, 0.1 * s, 0.14 * s), materials.eye);
  eye.name = 'phantom_sensor_eye';
  eye.position.set(0, 0.62 * s, 2.95 * s);
  eye.rotation.x = -0.38;
  group.add(eye);
  trackFade(materials.eye);
  const eyeGlow = createGlowSprite(0xff2a3a, 3.2 * s, 0.6);
  eyeGlow.name = 'phantom_sensor_glow';
  eyeGlow.position.set(0, 0.7 * s, 3.05 * s);
  group.add(eyeGlow);

  // ===== 激光长矛棱镜（机头下方）=====
  const prism = new THREE.Mesh(new THREE.OctahedronGeometry(0.5 * s, 0), materials.prism);
  prism.name = 'phantom_lance_prism';
  prism.position.set(0, -0.38 * s, 3.35 * s);
  prism.scale.set(0.85, 0.7, 1.5);
  prism.userData.hitRadius = 1.4 * s;
  group.add(prism);
  parts.push(prism);
  trackFade(materials.prism);
  const prismGlow = createGlowSprite(0xff4a8a, 2.4 * s, 0.35);
  prismGlow.name = 'phantom_lance_glow';
  prismGlow.position.copy(prism.position);
  group.add(prismGlow);
  const noseTip = new THREE.Object3D();
  noseTip.name = 'phantom_nose_tip';
  noseTip.position.set(0, -0.38 * s, 4.2 * s);
  group.add(noseTip);

  // ===== 尾喷口（真身：红色）=====
  const nozzleGeometry = new THREE.BoxGeometry(1.15 * s, 0.2 * s, 0.34 * s);
  const flameGeometry = createFlameGeometry(s);
  const engines: PhantomEngineRig[] = [];
  for (const side of [1, -1] as const) {
    const index = engines.length;
    const nozzle = new THREE.Mesh(nozzleGeometry, materials.nozzle);
    nozzle.name = `phantom_nozzle_${side > 0 ? 'L' : 'R'}`;
    nozzle.position.set(side * 1.5 * s, 0.5 * s, -1.42 * s);
    nozzle.userData.hitRadius = 1.3 * s;
    group.add(nozzle);
    parts.push(nozzle);
    const flame = new THREE.Mesh(flameGeometry, materials.flame);
    flame.name = `phantom_flame_${side > 0 ? 'L' : 'R'}`;
    flame.position.set(side * 1.5 * s, 0.5 * s, -1.6 * s);
    flame.scale.set(1.3, 0.45, 1);
    flame.renderOrder = 0;
    group.add(flame);
    const glow = createGlowSprite(0xff3a22, 4.2 * s, 0.7);
    glow.name = `phantom_engine_glow_${side > 0 ? 'L' : 'R'}`;
    glow.position.set(side * 1.5 * s, 0.55 * s, -1.9 * s);
    group.add(glow);
    engines.push({ index, side, nozzle, flame, glow });
  }
  trackFade(materials.nozzle);

  // ===== 翼尖相位发射器（子目标）=====
  const emitters: PhantomEmitterRig[] = [];
  const podGeometry = new THREE.CapsuleGeometry(0.3 * s, 1.3 * s, 4, 10);
  podGeometry.rotateX(Math.PI / 2);
  for (const side of [1, -1] as const) {
    const index = emitters.length;
    const pod = new THREE.Mesh(podGeometry, materials.pod);
    pod.name = `phantom_phase_emitter_${side > 0 ? 'L' : 'R'}`;
    pod.position.set(side * 7.05 * s, 0.05 * s, -1.55 * s);
    pod.userData.hitRadius = 1.5 * s;
    group.add(pod);
    parts.push(pod);
    const lensMaterial = createFadeMaterial({
      color: 0x1a0830,
      roughness: 0.15,
      metalness: 0.2,
      emissive: 0xb47aff,
      emissiveIntensity: 2.2,
    });
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.26 * s, 12, 8), lensMaterial);
    lens.name = `phantom_phase_lens_${side > 0 ? 'L' : 'R'}`;
    lens.position.set(0, 0, 0.95 * s);
    pod.add(lens);
    trackFade(lensMaterial);
    const glow = createGlowSprite(0xb47aff, 3.4 * s, 0.6);
    glow.name = `phantom_phase_glow_${side > 0 ? 'L' : 'R'}`;
    glow.position.set(side * 7.05 * s, 0.05 * s, -0.55 * s);
    group.add(glow);
    emitters.push({ index, side, pod, lensMaterial, glow });
  }
  trackFade(materials.pod);

  // ===== 腹部导弹舱 =====
  const bayInterior = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5 * s, 1.9 * s).rotateX(Math.PI / 2),
    materials.bayInterior
  );
  bayInterior.name = 'phantom_missile_bay';
  // 舱内甲板位于机腹隆起下表面之外：舱门关闭时被盖住，打开后从下方可见
  bayInterior.position.set(0, -0.7 * s, 0.2 * s);
  bayInterior.userData.hitRadius = 1.6 * s;
  group.add(bayInterior);
  trackFade(materials.bayInterior);
  const bayDoors: THREE.Group[] = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.name = `phantom_bay_door_${side > 0 ? 'L' : 'R'}`;
    pivot.position.set(side * 0.78 * s, -0.76 * s, 0.2 * s);
    group.add(pivot);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.78 * s, 0.08 * s, 1.95 * s),
      materials.door
    );
    door.name = `phantom_bay_door_plate_${side > 0 ? 'L' : 'R'}`;
    door.position.set(-side * 0.39 * s, 0, 0);
    pivot.add(door);
    bayDoors.push(pivot);
  }
  trackFade(materials.door);
  const bayLaunch = new THREE.Object3D();
  bayLaunch.name = 'phantom_bay_launch';
  bayLaunch.position.set(0, -1.6 * s, 0.2 * s);
  group.add(bayLaunch);

  // ===== 机炮口 + 外翼碰撞锚点 =====
  const muzzles: THREE.Object3D[] = [];
  const wingAnchors: THREE.Object3D[] = [];
  for (const side of [1, -1]) {
    const muzzle = new THREE.Object3D();
    muzzle.name = `phantom_cannon_${side > 0 ? 'L' : 'R'}`;
    muzzle.position.set(side * 1.9 * s, -0.05 * s, 2.35 * s);
    group.add(muzzle);
    muzzles.push(muzzle);
    const anchor = new THREE.Object3D();
    anchor.name = `phantom_wing_anchor_${side > 0 ? 'L' : 'R'}`;
    anchor.position.set(side * 4.7 * s, 0, -0.6 * s);
    anchor.userData.hitRadius = 2.6 * s;
    group.add(anchor);
    wingAnchors.push(anchor);
    parts.push(anchor);
  }

  group.userData.hitRadius = 3.6 * s;
  const rig: PhantomWingRig = {
    scale: s,
    body,
    bodyGeometry,
    seamGeometry,
    nozzleGeometry,
    flameGeometry,
    shimmer,
    wingAnchors,
    prism,
    prismGlow,
    eye,
    eyeGlow,
    engines,
    emitters,
    bayInterior,
    bayDoors,
    muzzles,
    noseTip,
    bayLaunch,
    fadeMaterials,
    halfSpan: HALF_SPAN * s,
    length: 5.8 * s,
    materials,
  };
  group.phantomRig = rig;
  group.bossParts = parts;
  return group;
}

export interface PhantomDecoyMaterials {
  body: THREE.MeshStandardMaterial;
  seam: THREE.MeshStandardMaterial;
  nozzle: THREE.MeshStandardMaterial;
  flame: THREE.MeshBasicMaterial;
}

/** 诱饵专用材质：机体与真身一致，尾喷口 / 尾焰为青色（多个诱饵共用） */
export function createPhantomDecoyMaterials(): PhantomDecoyMaterials {
  return {
    body: createFadeMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.42,
      metalness: 0.32,
      emissive: 0x160c2a,
      emissiveIntensity: 0.55,
    }),
    seam: createFadeMaterial({
      color: 0x062030,
      roughness: 0.3,
      metalness: 0.2,
      emissive: 0x5ae2ff,
      emissiveIntensity: 1.8,
    }),
    nozzle: createFadeMaterial({
      color: 0x04202a,
      roughness: 0.3,
      metalness: 0.4,
      emissive: 0x4ae8ff,
      emissiveIntensity: 2.2,
    }),
    flame: createGlowMaterial(0x4ae0ff, 0.75, { side: THREE.DoubleSide, vertexColors: true }),
  };
}

export interface PhantomDecoyRig {
  root: THREE.Group;
  flames: THREE.Mesh[];
  glows: THREE.Sprite[];
}

/**
 * 全息诱饵：与真身共用几何体（userData.sharedResource，避免被诱饵的释放流程释放），
 * 根节点即碰撞部件（userData.hitRadius / phantomDecoy / bossDecoy）。
 */
export function createPhantomDecoyMesh(
  rig: PhantomWingRig,
  materials: PhantomDecoyMaterials,
  index: number
): PhantomDecoyRig {
  const s = rig.scale;
  const root = new THREE.Group();
  root.name = `phantom_decoy_${index}`;
  root.userData.hitRadius = 3.6 * s;
  root.userData.phantomDecoy = true;
  root.userData.bossDecoy = true;
  const share = (mesh: THREE.Object3D): void => {
    mesh.userData.sharedResource = true;
  };
  const body = new THREE.Mesh(rig.bodyGeometry, materials.body);
  body.name = `phantom_decoy_${index}_body`;
  share(body);
  const seams = new THREE.Mesh(rig.seamGeometry, materials.seam);
  seams.name = `phantom_decoy_${index}_seams`;
  share(seams);
  root.add(body, seams);
  const flames: THREE.Mesh[] = [];
  const glows: THREE.Sprite[] = [];
  for (const side of [1, -1]) {
    const nozzle = new THREE.Mesh(rig.nozzleGeometry, materials.nozzle);
    nozzle.position.set(side * 1.5 * s, 0.5 * s, -1.42 * s);
    share(nozzle);
    const flame = new THREE.Mesh(rig.flameGeometry, materials.flame);
    flame.position.set(side * 1.5 * s, 0.5 * s, -1.6 * s);
    flame.scale.set(1.3, 0.45, 1);
    share(flame);
    const glow = createGlowSprite(0x4ae0ff, 4.2 * s, 0.7);
    glow.position.set(side * 1.5 * s, 0.55 * s, -1.9 * s);
    root.add(nozzle, flame, glow);
    flames.push(flame);
    glows.push(glow);
  }
  root.visible = false;
  return { root, flames, glows };
}
