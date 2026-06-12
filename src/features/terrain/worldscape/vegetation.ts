/**
 * worldscape/vegetation — 森林、草地与碎石，全部实例化。
 * 从 worldshowcase (src/world/vegetation.js) 移植：
 * 放置由绘制地形的同一组噪声场驱动——树长在读作森林的地面上，
 * 草只生在读作草地的地方。几何配方（松树锥塔、阔叶团簇、
 * 抖动二十面体岩石、五叶草簇）原样保留，数量与尺寸按关卡参数化。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from './noise';
import { Heightfield } from './heightfield';
import {
  injectSnowAndWind,
  injectSnowCover,
  injectWindSway,
  type ShaderUniform,
  type SnowWorldYRange,
} from './shadermods';

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** 写入一个实例的位置/朝向/缩放 */
export function setScatterInstance(
  mesh: THREE.InstancedMesh,
  index: number,
  x: number,
  y: number,
  z: number,
  rotY: number,
  scale: number
): void {
  _p.set(x, y, z);
  _q.setFromAxisAngle(Y_AXIS, rotY);
  _s.setScalar(scale);
  _m.compose(_p, _q, _s);
  mesh.setMatrixAt(index, _m);
}

/* ---------------- 几何配方（worldshowcase 原版） ---------------- */

export interface TreeGeometry {
  trunk: THREE.BufferGeometry;
  foliage: THREE.BufferGeometry;
  height: number;
}

/** 松树：圆柱树干 + 三层圆锥塔 */
export function pineGeometries(): TreeGeometry {
  const trunk = new THREE.CylinderGeometry(0.14, 0.24, 1.6, 6);
  trunk.translate(0, 0.8, 0);

  const cones: THREE.BufferGeometry[] = [];
  const tiers = [
    { r: 1.5, h: 2.3, y: 1.5 },
    { r: 1.15, h: 2.0, y: 3.0 },
    { r: 0.78, h: 1.7, y: 4.4 },
  ];
  for (const t of tiers) {
    const c = new THREE.ConeGeometry(t.r, t.h, 7);
    c.translate(0, t.y + t.h / 2, 0);
    cones.push(c);
  }
  const foliage = mergeGeometries(cones);
  cones.forEach((c) => c.dispose());
  return { trunk, foliage, height: 6.2 };
}

/** 阔叶树：树干 + 四个错落的二十面体叶团 */
export function leafTreeGeometries(rand: () => number): TreeGeometry {
  const trunk = new THREE.CylinderGeometry(0.18, 0.3, 2.2, 6);
  trunk.translate(0, 1.1, 0);

  const blobs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.IcosahedronGeometry(1, 0);
    const s = 1.15 + rand() * 0.7;
    g.scale(s, s * 0.85, s);
    g.translate((rand() - 0.5) * 1.5, 3.0 + (rand() - 0.4) * 1.1, (rand() - 0.5) * 1.5);
    blobs.push(g);
  }
  const foliage = mergeGeometries(blobs);
  blobs.forEach((g) => g.dispose());
  return { trunk, foliage, height: 4.6 };
}

/** 岩石：共享顶点一致抖动的二十面体 */
export function rockGeometry(rand: () => number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const pos = g.attributes.position;
  const seen = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let f = seen.get(key);
    if (f === undefined) {
      f = 0.74 + rand() * 0.5;
      seen.set(key, f);
    }
    pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f * 0.82, pos.getZ(i) * f);
  }
  g.computeVertexNormals();
  return g;
}

/** 草簇：五片锥形叶片绕原点展开，根暗梢亮的顶点色 */
export function grassTuftGeometry(rootColor = 0x4d7a3c, tipColor = 0xa4c25e): THREE.BufferGeometry {
  const blades = 5;
  const positions: number[] = [];
  const colors: number[] = [];
  const root = new THREE.Color(rootColor);
  const tip = new THREE.Color(tipColor);
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + b * 0.7;
    const lean = 0.22;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const w = 0.085;
    positions.push(-dz * w, 0, dx * w, dz * w, 0, -dx * w, dx * lean, 1, dz * lean);
    colors.push(root.r, root.g, root.b, root.r, root.g, root.b, tip.r, tip.g, tip.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/* ---------------- 放置 ---------------- */

export interface VegetationUniforms {
  time: ShaderUniform;
  wind: ShaderUniform;
  snow: ShaderUniform;
}

export interface ScatterRule {
  count: number;
  minHeight: number;
  maxHeight: number;
  maxSlope: number;
}

export interface GrassRule extends ScatterRule {
  rootColor?: number;
  tipColor?: number;
  /** 实例色 HSL 参数：hueBase + dry·hueDryShift（worldshowcase: 0.24 / 0.05） */
  hueBase?: number;
  hueDryShift?: number;
  saturation?: number;
  lightnessBase?: number;
  lightnessRand?: number;
}

export interface VegetationProfile {
  seed: number;
  /** 放置半边长（米） */
  half: number;
  /** 雪线（局部高度），影响松树上界与高山冷色 */
  snowLine: number;
  pines?: ScatterRule;
  broadleaf?: ScatterRule;
  rocks?: { count: number; minHeight: number };
  grass?: GrassRule;
  /** 尺寸放大（AirSupreme 世界更大、视点更高，默认放大以保持可读性） */
  sizeScale?: { tree?: number; rock?: number; grass?: number };
  /** 岩石实例色 RGB 暖度因子（默认 worldshowcase 的 1.04/1/0.92） */
  rockTint?: { r: number; g: number; b: number };
  /** 雪覆盖着色生效的世界 Y 范围 */
  snowWorldY?: SnowWorldYRange;
  /** 松针森林密度阈值（worldshowcase: 0.06） */
  pineForestThreshold?: number;
  /** 阔叶湿度阈值（worldshowcase: 0.45） */
  leafMoistureThreshold?: number;
}

export interface WorldscapeVegetation {
  group: THREE.Group;
  dispose(): void;
}

/** 用噪声场驱动的拒绝采样铺满森林/岩石/草地，全部实例化 */
export function buildVegetation(
  field: Heightfield,
  profile: VegetationProfile,
  uniforms: VegetationUniforms
): WorldscapeVegetation {
  const rand = mulberry32(profile.seed);
  const half = profile.half;
  const group = new THREE.Group();
  group.name = 'worldscapeVegetation';
  const treeScale = profile.sizeScale?.tree ?? 1.7;
  const rockScale = profile.sizeScale?.rock ?? 1.7;
  const grassScale = profile.sizeScale?.grass ?? 1.9;
  const snowLine = profile.snowLine;
  const snowRange = profile.snowWorldY;
  const disposables: Array<{ dispose(): void }> = [];

  /* ----- 松树 ----- */
  if (profile.pines && profile.pines.count > 0) {
    const rule = profile.pines;
    const pine = pineGeometries();
    const pineTrunkMat = new THREE.MeshStandardMaterial({
      color: 0x6b4a33,
      flatShading: true,
      roughness: 1,
    });
    const pineLeafMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      roughness: 1,
    });
    injectSnowAndWind(pineLeafMat, uniforms.snow, uniforms.time, uniforms.wind, 0.18, 6.0, 'pine', snowRange);
    injectSnowCover(pineTrunkMat, uniforms.snow, 'trunk', snowRange);

    const pineTrunks = new THREE.InstancedMesh(pine.trunk, pineTrunkMat, rule.count);
    const pineLeaves = new THREE.InstancedMesh(pine.foliage, pineLeafMat, rule.count);
    disposables.push(pine.trunk, pine.foliage, pineTrunkMat, pineLeafMat, pineTrunks, pineLeaves);

    const forestThreshold = profile.pineForestThreshold ?? 0.06;
    let placed = 0;
    let guard = 0;
    while (placed < rule.count && guard++ < rule.count * 30) {
      const x = (rand() * 2 - 1) * half;
      const z = (rand() * 2 - 1) * half;
      const h = field.heightAt(x, z);
      if (h < rule.minHeight || h > rule.maxHeight) continue;
      if (field.slopeAt(x, z) > rule.maxSlope) continue;
      const f = field.forestField(x, z);
      const altT = h > snowLine - 30 ? 0.22 : 0; // 雪线附近渐疏
      if (f < forestThreshold + altT + rand() * 0.3) continue;

      const s = (0.8 + rand() * 0.75) * treeScale;
      const rot = rand() * Math.PI * 2;
      setScatterInstance(pineTrunks, placed, x, h - 0.15, z, rot, s);
      setScatterInstance(pineLeaves, placed, x, h - 0.15, z, rot, s);
      // 海拔越高绿色越冷，湿度调饱和
      const cold = Math.min(1, Math.max(0, (h - 30) / 130));
      _c.setHSL(0.33 - cold * 0.06, 0.38 + field.moistureField(x, z) * 0.2, 0.26 + rand() * 0.08);
      pineLeaves.setColorAt(placed, _c);
      placed++;
    }
    pineTrunks.count = placed;
    pineLeaves.count = placed;
    registerScatterMesh(group, pineTrunks, true);
    registerScatterMesh(group, pineLeaves, true);
  }

  /* ----- 阔叶树 ----- */
  if (profile.broadleaf && profile.broadleaf.count > 0) {
    const rule = profile.broadleaf;
    const leaf = leafTreeGeometries(rand);
    const leafTrunkMat = new THREE.MeshStandardMaterial({
      color: 0x7a5a40,
      flatShading: true,
      roughness: 1,
    });
    const leafLeafMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      roughness: 1,
    });
    injectSnowAndWind(leafLeafMat, uniforms.snow, uniforms.time, uniforms.wind, 0.22, 4.4, 'leaf', snowRange);
    injectSnowCover(leafTrunkMat, uniforms.snow, 'trunk2', snowRange);

    const leafTrunks = new THREE.InstancedMesh(leaf.trunk, leafTrunkMat, rule.count);
    const leafLeaves = new THREE.InstancedMesh(leaf.foliage, leafLeafMat, rule.count);
    disposables.push(leaf.trunk, leaf.foliage, leafTrunkMat, leafLeafMat, leafTrunks, leafLeaves);

    const moistureThreshold = profile.leafMoistureThreshold ?? 0.45;
    let placed = 0;
    let guard = 0;
    while (placed < rule.count && guard++ < rule.count * 30) {
      const x = (rand() * 2 - 1) * half;
      const z = (rand() * 2 - 1) * half;
      const h = field.heightAt(x, z);
      if (h < rule.minHeight || h > rule.maxHeight) continue;
      if (field.slopeAt(x, z) > rule.maxSlope) continue;
      if (field.moistureField(x, z) < moistureThreshold + rand() * 0.25) continue;

      const s = (0.85 + rand() * 0.7) * treeScale;
      const rot = rand() * Math.PI * 2;
      setScatterInstance(leafTrunks, placed, x, h - 0.1, z, rot, s);
      setScatterInstance(leafLeaves, placed, x, h - 0.1, z, rot, s);
      _c.setHSL(0.27 + rand() * 0.06, 0.45, 0.3 + rand() * 0.1);
      leafLeaves.setColorAt(placed, _c);
      placed++;
    }
    leafTrunks.count = placed;
    leafLeaves.count = placed;
    registerScatterMesh(group, leafTrunks, true);
    registerScatterMesh(group, leafLeaves, true);
  }

  /* ----- 岩石 ----- */
  if (profile.rocks && profile.rocks.count > 0) {
    const rule = profile.rocks;
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      roughness: 1,
    });
    injectSnowCover(rockMat, uniforms.snow, 'rock', snowRange);
    const rockGeo = rockGeometry(rand);
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rule.count);
    disposables.push(rockGeo, rockMat, rocks);
    const tint = profile.rockTint ?? { r: 1.04, g: 1, b: 0.92 };

    let placed = 0;
    let guard = 0;
    while (placed < rule.count && guard++ < rule.count * 30) {
      const x = (rand() * 2 - 1) * half;
      const z = (rand() * 2 - 1) * half;
      const h = field.heightAt(x, z);
      if (h < rule.minHeight) continue;
      const sl = field.slopeAt(x, z);
      // 碎石偏爱坡地，草甸上只留稀疏漂砾
      if (sl < 0.25 && rand() > 0.18) continue;

      const s = (0.5 + rand() * rand() * 3.4) * rockScale;
      setScatterInstance(rocks, placed, x, h + s * 0.12, z, rand() * Math.PI * 2, s);
      const g = 0.45 + rand() * 0.22;
      _c.setRGB(g * tint.r, g * tint.g, g * tint.b);
      rocks.setColorAt(placed, _c);
      placed++;
    }
    rocks.count = placed;
    registerScatterMesh(group, rocks, true);
  }

  /* ----- 草地 ----- */
  if (profile.grass && profile.grass.count > 0) {
    const rule = profile.grass;
    const grassMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      side: THREE.DoubleSide,
    });
    injectWindSway(grassMat, uniforms.time, uniforms.wind, 0.5, 1.0, 'grass');
    const grassGeo = grassTuftGeometry(rule.rootColor, rule.tipColor);
    const grass = new THREE.InstancedMesh(grassGeo, grassMat, rule.count);
    disposables.push(grassGeo, grassMat, grass);

    const hueBase = rule.hueBase ?? 0.24;
    const hueDryShift = rule.hueDryShift ?? 0.05;
    const saturation = rule.saturation ?? 0.45;
    const lightnessBase = rule.lightnessBase ?? 0.55;
    const lightnessRand = rule.lightnessRand ?? 0.2;

    let placed = 0;
    let guard = 0;
    while (placed < rule.count && guard++ < rule.count * 10) {
      const x = (rand() * 2 - 1) * half;
      const z = (rand() * 2 - 1) * half;
      const h = field.heightAt(x, z);
      if (h < rule.minHeight || h > rule.maxHeight) continue;
      if (field.slopeAt(x, z) > rule.maxSlope) continue;

      const s = (0.7 + rand() * 0.9) * grassScale;
      setScatterInstance(grass, placed, x, h - 0.05, z, rand() * Math.PI * 2, s);
      const dry = 1 - field.moistureField(x, z);
      _c.setHSL(hueBase + dry * hueDryShift, saturation, lightnessBase + rand() * lightnessRand);
      grass.setColorAt(placed, _c);
      placed++;
    }
    grass.count = placed;
    registerScatterMesh(group, grass, false);
  }

  return {
    group,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

function registerScatterMesh(group: THREE.Group, mesh: THREE.InstancedMesh, castShadow: boolean): void {
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  // 实例散布覆盖全图：禁用视锥剔除，避免按几何包围盒误剔除
  mesh.frustumCulled = false;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);
}
