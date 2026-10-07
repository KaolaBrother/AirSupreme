/**
 * 雷鸣峡谷岩体布景：
 * - 孤丘 / 尖塔 / 台地（分层星形轮廓挤出 + 线性碎石坡裙），主峡谷盆地与台地上；
 * - 石林（hoodoo）：台阶与崖缘上的成簇岩柱（实例化）；
 * - 崖脚碎石、谷底巨砾、台面灌丛（实例化，不参与采样）。
 * 所有岩体使用同一层理材质（按世界高度着色，与峡谷崖壁的地层一致）；
 * 孤丘 / 台地 / 石柱的足迹登记进 StructureField，采样高度与可见几何一致。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { smoothstep } from '../worldscape/noise';
import { CANYON_PLATEAU, CanyonVertexKind, type CanyonField } from './CanyonField';
import { PolarShape, setInstanceTransform } from './envKit';
import type { StructureField } from './structureField';

export interface CanyonFormationContext {
  field: CanyonField;
  structures: StructureField;
  waterY: number;
  rng: () => number;
  detailScale: number;
  isMobile: boolean;
  strata: THREE.MeshStandardMaterial;
  vegetation: THREE.ColorRepresentation;
  vegetationAccent: THREE.ColorRepresentation;
}

/** 已放置的大型岩体（供塔架 / 系泊塔选址） */
export interface CanyonFormation {
  x: number;
  z: number;
  /** 顶层半径与顶面世界高度 */
  topRadius: number;
  topY: number;
  kind: 'butte' | 'spire' | 'mesa';
}

interface FormationSpec {
  x: number;
  z: number;
  radius: number;
  /** 底部地面局部高度 */
  ground: number;
  /** 各层顶面相对地面的高度（递增） */
  tiers: number[];
  /** 每层半径收缩比 */
  shrink: number;
  roughness: number;
  kind: CanyonFormation['kind'];
}

const APRON_SCALE = 1.32;

export function buildCanyonFormations(ctx: CanyonFormationContext): {
  group: THREE.Group;
  formations: CanyonFormation[];
} {
  const group = new THREE.Group();
  group.name = 'canyonFormations';
  const specs = planFormations(ctx);
  const formations: CanyonFormation[] = [];
  const geometries: THREE.BufferGeometry[] = [];

  for (const spec of specs) {
    const built = buildFormation(spec, ctx, geometries);
    formations.push(built);
  }
  if (geometries.length > 0) {
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((geometry) => geometry.dispose());
    if (merged) {
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, ctx.strata);
      mesh.name = 'canyonButtes';
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }

  buildHoodoos(ctx, group, formations);
  buildScatter(ctx, group, formations);
  return { group, formations };
}

/* ------------------------------------------------------------------ */
/* 选址                                                                */
/* ------------------------------------------------------------------ */

function planFormations(ctx: CanyonFormationContext): FormationSpec[] {
  const { field, rng } = ctx;
  const specs: FormationSpec[] = [];
  const clear = (x: number, z: number, radius: number): boolean =>
    specs.every(
      (s) => Math.hypot(s.x - x, s.z - z) > s.radius * APRON_SCALE + radius * APRON_SCALE + 25
    );

  // 主峡谷盆地与后方开阔段的孤丘 / 尖塔：沿谷底分布，避开河道与土路
  const basin: Array<{
    z: number;
    f: number;
    r: number;
    tiers: number[];
    kind: FormationSpec['kind'];
  }> = [
    { z: -640, f: 0.15, r: 34, tiers: [62, 128, 168], kind: 'spire' },
    { z: -820, f: -0.12, r: 62, tiers: [70, 118, 140], kind: 'butte' },
    { z: -1010, f: 0.28, r: 52, tiers: [84, 150], kind: 'butte' },
    { z: -1180, f: -0.05, r: 92, tiers: [58, 104], kind: 'mesa' },
    { z: -935, f: 0.5, r: 22, tiers: [96, 152], kind: 'spire' },
    { z: -1330, f: 0.42, r: 26, tiers: [70, 122], kind: 'spire' },
    { z: 1180, f: -0.2, r: 46, tiers: [76, 132], kind: 'butte' },
    { z: 1340, f: 0.25, r: 24, tiers: [88, 140], kind: 'spire' },
  ];
  for (const item of basin) {
    const state = field.rowState(item.z);
    const x = state.main.center + item.f * state.main.floorHalf;
    const reach = item.r * APRON_SCALE + 10;
    // 与河道 / 土路 / 崖脚保持距离
    if (Math.abs(x - state.riverCenter) < reach + state.riverHalf + 8) continue;
    if (Math.abs(x - state.roadCenter) < reach + state.roadHalf + 6) continue;
    if (x - reach < state.main.center - state.main.floorHalf + 4) continue;
    if (x + reach > state.main.center + state.main.floorHalf - 4) continue;
    if (!clear(x, item.z, item.r)) continue;
    specs.push({
      x,
      z: item.z,
      radius: item.r,
      ground: state.main.floor,
      tiers: item.tiers,
      shrink: item.kind === 'spire' ? 0.72 : 0.66,
      roughness: item.kind === 'spire' ? 0.2 : 0.25,
      kind: item.kind,
    });
  }

  // 台地上的大型平顶山与小孤丘：随机候选点，足迹必须完整落在台地上
  const mesaTarget = ctx.isMobile ? 5 : 7;
  let mesas = 0;
  for (let attempt = 0; attempt < 600 && mesas < mesaTarget; attempt++) {
    const z = (rng() - 0.5) * 2900;
    const state = field.rowState(z);
    const big = mesas < 4;
    const radius = big ? 110 + rng() * 80 : 40 + rng() * 30;
    // 候选：西鳍 / 东鳍 / 外侧台地
    const pick = Math.floor(rng() * 4);
    const ranges: Array<[number, number]> = [
      [state.west.lipEast, state.main.lipWest],
      [state.main.lipEast, state.east.lipWest],
      [state.escarpmentWest, state.west.lipWest],
      [state.east.lipEast, state.escarpmentEast],
    ];
    const [a, b] = ranges[pick];
    if (b - a < radius * 2.4) continue;
    const x = a + radius * 1.2 + rng() * (b - a - radius * 2.4);
    if (Math.hypot(x, z) > 1650) continue;
    if (!clear(x, z, radius)) continue;
    let flat = true;
    for (let k = 0; k < 16 && flat; k++) {
      const angle = (k / 16) * Math.PI * 2;
      const g = field.sampleGround(
        x + Math.cos(angle) * radius * APRON_SCALE,
        z + Math.sin(angle) * radius * APRON_SCALE
      );
      flat = g > CANYON_PLATEAU - 7 && g < CANYON_PLATEAU + 8;
    }
    if (!flat) continue;
    const ground = field.sampleGround(x, z);
    specs.push({
      x,
      z,
      radius,
      ground: ground - 1,
      tiers: big ? [34 + rng() * 14, 62 + rng() * 26] : [30 + rng() * 20, 54 + rng() * 22],
      shrink: big ? 0.74 : 0.62,
      roughness: big ? 0.26 : 0.22,
      kind: big ? 'mesa' : 'butte',
    });
    mesas++;
  }
  return specs;
}

/* ------------------------------------------------------------------ */
/* 分层孤丘几何                                                         */
/* ------------------------------------------------------------------ */

function buildFormation(
  spec: FormationSpec,
  ctx: CanyonFormationContext,
  out: THREE.BufferGeometry[]
): CanyonFormation {
  const { rng, structures, waterY } = ctx;
  const groundY = waterY + spec.ground;
  const segments = ctx.isMobile ? 40 : spec.radius > 80 ? 84 : 64;
  const taper = spec.kind === 'spire' ? 0.9 : 0.87;
  const base = rockOutline(rng, spec.x, spec.z, spec.radius, spec.roughness);
  const tint = 0.94 + rng() * 0.1;

  // 碎石坡裙：基座外缘线性下坡到地面以下
  const apronTop = groundY + Math.min(spec.tiers[0] * 0.24, 26);
  const apronBottom = groundY - 2;
  out.push(buildApron(base, apronTop, apronBottom, segments, tint));
  structures.addPolar({ shape: base, top: apronTop, apronScale: APRON_SCALE, apronBottom });

  let shape = base;
  let bottom = groundY - 4;
  let topY = groundY;
  spec.tiers.forEach((tierHeight, index) => {
    if (index > 0) {
      // 上层轮廓：收缩并带轻微偏心，形成不对称的台阶
      const radius = shape.radius * spec.shrink * (0.94 + rng() * 0.08);
      const offset = shape.radius * (1 - spec.shrink) * 0.3;
      const angle = rng() * Math.PI * 2;
      shape = rockOutline(
        rng,
        shape.centerX + Math.cos(angle) * offset,
        shape.centerZ + Math.sin(angle) * offset,
        radius,
        spec.roughness * 0.85
      );
    }
    topY = groundY + tierHeight;
    out.push(buildTier(shape, taper, bottom, topY, segments, tint));
    // 收分崖壁：顶面轮廓之内为顶高，向外线性降到底部轮廓（= 顶面轮廓 / taper）
    structures.addPolar({ shape, top: topY, apronScale: 1 / taper, apronBottom: bottom });
    bottom = topY - 2.5;
  });
  return {
    x: shape.centerX,
    z: shape.centerZ,
    topRadius: shape.radius,
    topY,
    kind: spec.kind,
  };
}

/** 岩体轮廓：低频不规则起伏 + 高频竖向风化沟槽（扶壁 / 凹槽） */
function rockOutline(
  rng: () => number,
  centerX: number,
  centerZ: number,
  radius: number,
  roughness: number
): PolarShape {
  const tau = Math.PI * 2;
  return new PolarShape({
    centerX,
    centerZ,
    radius,
    harmonics: [
      { k: 2, amplitude: roughness * (0.4 + rng() * 0.5), phase: rng() * tau },
      { k: 3, amplitude: roughness * (0.3 + rng() * 0.4), phase: rng() * tau },
      { k: 5, amplitude: roughness * (0.15 + rng() * 0.25), phase: rng() * tau },
      { k: 9, amplitude: roughness * (0.06 + rng() * 0.1), phase: rng() * tau },
      { k: 13 + Math.floor(rng() * 4), amplitude: 0.022 + rng() * 0.012, phase: rng() * tau },
      { k: 22 + Math.floor(rng() * 5), amplitude: 0.012 + rng() * 0.008, phase: rng() * tau },
    ],
  });
}

function paint(geometry: THREE.BufferGeometry, tint: number): void {
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3).fill(tint);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/** 收分的岩层：底圈 = 顶面轮廓 / taper，顶面为自中心的三角扇（星形轮廓保证无自交） */
function buildTier(
  shape: PolarShape,
  taper: number,
  bottom: number,
  top: number,
  segments: number,
  tint: number
): THREE.BufferGeometry {
  const positions: number[] = [];
  const topRing: Array<[number, number, number]> = [];
  const bottomRing: Array<[number, number, number]> = [];
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const r = shape.radiusAt(theta);
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    topRing.push([shape.centerX + c * r, top, shape.centerZ + s * r]);
    bottomRing.push([shape.centerX + (c * r) / taper, bottom, shape.centerZ + (s * r) / taper]);
  }
  const center: [number, number, number] = [shape.centerX, top, shape.centerZ];
  for (let i = 0; i < segments; i++) {
    const i1 = (i + 1) % segments;
    const b0 = bottomRing[i];
    const b1 = bottomRing[i1];
    const t0 = topRing[i];
    const t1 = topRing[i1];
    // 朝外的崖壁 + 朝上的顶面
    positions.push(...b0, ...t0, ...b1, ...b1, ...t0, ...t1);
    positions.push(...center, ...t1, ...t0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute(
    'uv',
    new THREE.BufferAttribute(new Float32Array((positions.length / 3) * 2), 2)
  );
  geometry.computeVertexNormals();
  paint(geometry, tint);
  return geometry;
}

/** 碎石坡裙：两圈顶点（归一化半径 1 → APRON_SCALE），与采样的线性坡一致 */
function buildApron(
  shape: PolarShape,
  top: number,
  bottom: number,
  segments: number,
  tint: number
): THREE.BufferGeometry {
  const positions: number[] = [];
  const ring = (scale: number, y: number): Array<[number, number, number]> => {
    const points: Array<[number, number, number]> = [];
    for (let i = 0; i < segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const r = shape.radiusAt(theta) * scale;
      points.push([shape.centerX + Math.cos(theta) * r, y, shape.centerZ + Math.sin(theta) * r]);
    }
    return points;
  };
  const inner = ring(1.0, top);
  const middle = ring((1 + APRON_SCALE) / 2, (top + bottom) / 2);
  const outer = ring(APRON_SCALE, bottom);
  const rings = [inner, middle, outer];
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < segments; i++) {
      const i1 = (i + 1) % segments;
      const a = rings[r][i];
      const b = rings[r][i1];
      const c = rings[r + 1][i];
      const d = rings[r + 1][i1];
      // 朝外向上的面：逆时针（俯视）
      positions.push(...a, ...b, ...c, ...b, ...d, ...c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute(
    'uv',
    new THREE.BufferAttribute(new Float32Array((positions.length / 3) * 2), 2)
  );
  geometry.computeVertexNormals();
  paint(geometry, tint * 0.96);
  return geometry;
}

/* ------------------------------------------------------------------ */
/* 石林                                                                */
/* ------------------------------------------------------------------ */

/** 单位尺寸的石林岩柱：粗基座 → 细颈 → 宽盖岩 */
function hoodooGeometry(variant: number): THREE.BufferGeometry {
  const profile =
    variant === 0
      ? [
          [1.0, 0],
          [0.86, 0.18],
          [0.64, 0.42],
          [0.74, 0.58],
          [0.48, 0.8],
          [0.95, 0.86],
          [0.9, 0.96],
          [0.2, 1.0],
        ]
      : [
          [1.0, 0],
          [0.72, 0.3],
          [0.8, 0.46],
          [0.55, 0.66],
          [0.62, 0.78],
          [0.4, 0.9],
          [0.78, 0.94],
          [0.15, 1.0],
        ];
  const points = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const lathe = new THREE.LatheGeometry(points, 7);
  const geometry = lathe.toNonIndexed();
  lathe.dispose();
  geometry.computeVertexNormals();
  paint(geometry, 1);
  return geometry;
}

interface Placement {
  x: number;
  y: number;
  z: number;
  radius: number;
  height: number;
  yaw: number;
}

/** 收集战场范围内某类顶点的索引 */
function collectKinds(field: CanyonField, kinds: readonly number[], limit: number): number[] {
  const out: number[] = [];
  const set = new Set(kinds);
  for (let j = 0; j < field.rowsZ.length; j++) {
    const z = field.rowsZ[j];
    if (Math.abs(z) > limit) continue;
    for (let i = 0; i < field.columns; i++) {
      const index = j * field.columns + i;
      if (set.has(field.kinds[index]) && Math.hypot(field.xs[index], z) < limit) {
        out.push(index);
      }
    }
  }
  return out;
}

function vertexPosition(field: CanyonField, index: number): { x: number; z: number } {
  const row = Math.floor(index / field.columns);
  return { x: field.xs[index], z: field.rowsZ[row] };
}

/** 局部坡度（中心差分，米/米） */
function slopeAt(field: CanyonField, x: number, z: number): number {
  const e = 3;
  const gx = (field.sampleGround(x + e, z) - field.sampleGround(x - e, z)) / (2 * e);
  const gz = (field.sampleGround(x, z + e) - field.sampleGround(x, z - e)) / (2 * e);
  return Math.hypot(gx, gz);
}

function insideFormation(
  formations: readonly CanyonFormation[],
  x: number,
  z: number,
  pad: number
): boolean {
  return formations.some((f) => Math.hypot(f.x - x, f.z - z) < f.topRadius * 1.9 + pad);
}

function buildHoodoos(
  ctx: CanyonFormationContext,
  group: THREE.Group,
  formations: readonly CanyonFormation[]
): void {
  const { field, rng, structures, waterY } = ctx;
  const benches = collectKinds(field, [CanyonVertexKind.BENCH, CanyonVertexKind.RIM], 1700);
  const target = Math.round(190 * ctx.detailScale);
  const placements: Placement[] = [];
  for (let attempt = 0; attempt < target * 8 && placements.length < target; attempt++) {
    if (benches.length === 0) break;
    // 成簇：先挑簇心，再在簇心附近撒 4~9 根
    const seed = vertexPosition(field, benches[Math.floor(rng() * benches.length)]);
    const clusterSize = 4 + Math.floor(rng() * 6);
    for (let k = 0; k < clusterSize && placements.length < target; k++) {
      const x = seed.x + (rng() - 0.5) * 34;
      const z = seed.z + (rng() - 0.5) * 34;
      if (slopeAt(field, x, z) > 0.32) continue;
      if (insideFormation(formations, x, z, 8)) continue;
      if (placements.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + 6)) continue;
      const height = 12 + rng() * rng() * 36;
      const radius = 2.6 + height * (0.1 + rng() * 0.06);
      placements.push({
        x,
        y: waterY + field.sampleGround(x, z) - 1.5,
        z,
        radius,
        height,
        yaw: rng() * Math.PI * 2,
      });
    }
  }
  if (placements.length === 0) return;
  const variants = [hoodooGeometry(0), hoodooGeometry(1)];
  const buckets: Placement[][] = [[], []];
  placements.forEach((p, i) => buckets[i % 2].push(p));
  variants.forEach((geometry, v) => {
    const list = buckets[v];
    const mesh = new THREE.InstancedMesh(geometry, ctx.strata, Math.max(1, list.length));
    mesh.name = `canyonHoodoos${v}`;
    list.forEach((p, i) => {
      setInstanceTransform(mesh, i, p.x, p.y, p.z, p.yaw, p.radius, p.height + 1.5, p.radius);
      // 足迹：基座 85% → 颈部，略宽容（不在空隙处误判坠毁）
      structures.addFrustum({
        x: p.x,
        z: p.z,
        r0: p.radius * 0.85,
        r1: p.radius * 0.5,
        y0: p.y,
        y1: p.y + p.height + 1.5,
      });
    });
    mesh.count = list.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });
}

/* ------------------------------------------------------------------ */
/* 碎石 / 巨砾 / 灌丛                                                  */
/* ------------------------------------------------------------------ */

function buildScatter(
  ctx: CanyonFormationContext,
  group: THREE.Group,
  formations: readonly CanyonFormation[]
): void {
  const { field, rng, waterY } = ctx;

  // 崖脚碎石与谷底巨砾
  const talus = collectKinds(field, [CanyonVertexKind.TALUS, CanyonVertexKind.FLOOR], 1750);
  const boulderCount = Math.round(380 * ctx.detailScale);
  const boulderGeometry = new THREE.DodecahedronGeometry(1, 0);
  const boulders = new THREE.InstancedMesh(boulderGeometry, ctx.strata, boulderCount);
  boulders.name = 'canyonBoulders';
  paint(boulderGeometry, 0.9);
  let placed = 0;
  for (let attempt = 0; attempt < boulderCount * 4 && placed < boulderCount; attempt++) {
    if (talus.length === 0) break;
    const seed = vertexPosition(field, talus[Math.floor(rng() * talus.length)]);
    const x = seed.x + (rng() - 0.5) * 20;
    const z = seed.z + (rng() - 0.5) * 14;
    const ground = field.sampleGround(x, z);
    if (ground < 0.6) continue; // 不进河道
    if (Math.abs(x - field.rowState(z).roadCenter) < 7) continue;
    const scale = 1.2 + rng() * rng() * 6.5;
    setInstanceTransform(
      boulders,
      placed++,
      x,
      waterY + ground + scale * 0.25,
      z,
      rng() * Math.PI * 2,
      scale * (0.9 + rng() * 0.4),
      scale * (0.55 + rng() * 0.35),
      scale,
      rng() * 0.5,
      rng() * 0.5
    );
  }
  boulders.count = placed;
  boulders.instanceMatrix.needsUpdate = true;
  boulders.castShadow = true;
  group.add(boulders);

  // 灌丛：杜松（锥）+ 鼠尾草（圆团），台阶 / 台地 / 谷底
  const green = collectKinds(
    field,
    [
      CanyonVertexKind.BENCH,
      CanyonVertexKind.PLATEAU,
      CanyonVertexKind.FLOOR,
      CanyonVertexKind.RIM,
    ],
    1750
  );
  const shrubMaterial = new THREE.MeshStandardMaterial({
    color: ctx.vegetation,
    roughness: 0.95,
    flatShading: true,
  });
  const sageMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(ctx.vegetationAccent).lerp(new THREE.Color(0x8a8a6a), 0.35),
    roughness: 1,
    flatShading: true,
  });
  const juniperGeometry = new THREE.ConeGeometry(1, 1, 6, 1);
  juniperGeometry.translate(0, 0.5, 0);
  const sageGeometry = new THREE.IcosahedronGeometry(1, 0);
  const shrubCount = Math.round(520 * ctx.detailScale);
  const junipers = new THREE.InstancedMesh(juniperGeometry, shrubMaterial, shrubCount);
  const sages = new THREE.InstancedMesh(sageGeometry, sageMaterial, shrubCount);
  junipers.name = 'canyonJunipers';
  sages.name = 'canyonSage';
  let juniperIndex = 0;
  let sageIndex = 0;
  // 河岸灌丛（柽柳 / 柳）更密：约三成候选点取自河岸顶点
  const banks = collectKinds(field, [CanyonVertexKind.BANK], 1750).filter(
    (index) => field.hs[index] > 2
  );
  for (let attempt = 0; attempt < shrubCount * 5; attempt++) {
    if (green.length === 0 || (juniperIndex >= shrubCount && sageIndex >= shrubCount)) break;
    const riparian = banks.length > 0 && rng() < 0.3;
    const pool = riparian ? banks : green;
    const seed = vertexPosition(field, pool[Math.floor(rng() * pool.length)]);
    const x = seed.x + (rng() - 0.5) * (riparian ? 14 : 40);
    const z = seed.z + (rng() - 0.5) * 18;
    const ground = field.sampleGround(x, z);
    if (ground < 1) continue;
    if (slopeAt(field, x, z) > 0.35) continue;
    if (insideFormation(formations, x, z, 0)) continue;
    const patch = smoothstep(-0.2, 0.6, Math.sin(x * 0.011) * Math.cos(z * 0.013));
    if (!riparian && rng() > 0.35 + patch * 0.65) continue;
    const y = waterY + ground;
    if (rng() < 0.45 && juniperIndex < shrubCount) {
      const h = 3 + rng() * 5;
      setInstanceTransform(
        junipers,
        juniperIndex++,
        x,
        y - 0.4,
        z,
        rng() * 6,
        h * 0.42,
        h,
        h * 0.42
      );
    } else if (sageIndex < shrubCount) {
      const s = 1.1 + rng() * 1.8;
      setInstanceTransform(
        sages,
        sageIndex++,
        x,
        y + s * 0.2,
        z,
        rng() * 6,
        s * 1.3,
        s * 0.6,
        s * 1.2
      );
    }
  }
  junipers.count = juniperIndex;
  sages.count = sageIndex;
  junipers.instanceMatrix.needsUpdate = true;
  sages.instanceMatrix.needsUpdate = true;
  group.add(junipers, sages);

  // 台地上的滑岩穹丘（slickrock）：扁平的低矮岩包，打破平整台面
  const plateau = collectKinds(
    field,
    [CanyonVertexKind.PLATEAU, CanyonVertexKind.HIGH_PLATEAU],
    2100
  );
  const outcropCount = Math.round(170 * ctx.detailScale);
  const outcropGeometry = new THREE.IcosahedronGeometry(1, 1);
  paint(outcropGeometry, 0.97);
  const outcrops = new THREE.InstancedMesh(outcropGeometry, ctx.strata, outcropCount);
  outcrops.name = 'canyonOutcrops';
  let outcropIndex = 0;
  for (let attempt = 0; attempt < outcropCount * 4 && outcropIndex < outcropCount; attempt++) {
    if (plateau.length === 0) break;
    const seed = vertexPosition(field, plateau[Math.floor(rng() * plateau.length)]);
    const x = seed.x + (rng() - 0.5) * 60;
    const z = seed.z + (rng() - 0.5) * 30;
    if (slopeAt(field, x, z) > 0.12) continue;
    if (insideFormation(formations, x, z, 10)) continue;
    const width = 7 + rng() * rng() * 22;
    const height = 1.6 + rng() * 4.5;
    setInstanceTransform(
      outcrops,
      outcropIndex++,
      x,
      waterY + field.sampleGround(x, z) - height * 0.35,
      z,
      rng() * Math.PI * 2,
      width,
      height,
      width * (0.55 + rng() * 0.4)
    );
  }
  outcrops.count = outcropIndex;
  outcrops.instanceMatrix.needsUpdate = true;
  outcrops.receiveShadow = true;
  group.add(outcrops);
}
