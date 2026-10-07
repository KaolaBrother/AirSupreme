/**
 * 黑曜城堡：神谕的最终堡垒（陨石坑中心）。
 *
 * - 两级八边形台基（正方向四条坡道），台基中央是核心井：同心旋转光环“虹膜”与白炽核心，
 *   核心光柱直冲云霄；井口一圈电容柱；
 * - 八边形城墙（四座城门，墙面扶壁、品红饰带）、八座角堡（收分冠顶 + 尖塔 + 探照灯）、
 *   城门两侧的青色灯柱塔、四座处理器大厅；
 * - 四座导能尖碑（对角方向）：尖顶晶体向核心光柱输送能量，光柱上方悬浮旋转的全息数据环；
 * - 坑底：四条正方向的能量导管（数据流奔向核心）与坑壁处的地热汲取站、黑色数据方碑、
 *   坑缘的雷达防空阵地。
 * 所有实体登记精确足迹（台基为挖去井口的环形足迹，井底 / 核心为柱 / 穹顶），boss 决战区为
 * 核心井上空（神谕主宰在 y≈160 处现身）。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { SceneDesignTokens } from '../LevelConfig';
import { mergeStaticMeshes, setInstanceTransform, type PuffEmitter } from './envKit';
import type { GlowCard } from './lavaMaterials';
import type { StructureField } from './structureField';
import {
  CITADEL_CENTER,
  CONDUIT_ANGLES,
  CONDUIT_HALF_WIDTH,
  CONDUIT_INNER_RADIUS,
  CONDUIT_OUTER_RADIUS,
  CRATER_FLOOR,
  type CitadelField,
} from './CitadelField';
import {
  CITADEL_CYAN,
  CITADEL_MAGENTA,
  createBeamMaterial,
  createConduitMaterial,
  createDeckMaterial,
  createIrisMaterial,
  createNeonMaterial,
  createObsidianMaterial,
  createSearchlightMaterial,
} from './citadelMaterials';

/** 台基 / 城墙尺寸（米，局部高度相对水位） */
const DAIS_OUTER = 400;
const DAIS_INNER = 360;
const DAIS_LOW_TOP = 22;
const DAIS_TOP = 36;
const WELL_RADIUS = 108;
const WELL_FLOOR = 12;
const CURB_OUTER = 116;
const CURB_TOP = 40;
const WALL_RADIUS = 330;
const WALL_BASE = 34;
const WALL_TOP = 76;
const WALL_THICKNESS = 16;
const GATE_WIDTH = 70;
const RAMP_OUTER = 520;
/** 坡道内端：上层台基八边形在正方向的内切半径（略微嵌入台基） */
const RAMP_INNER = DAIS_INNER * Math.cos(Math.PI / 8) - 1;
/** 核心光柱顶端 / 全息环高度（世界 Y） */
const BEAM_TOP = 2600;
const FEED_Y = 222;

export interface FortressContext {
  tokens: SceneDesignTokens;
  field: CitadelField;
  structures: StructureField;
  waterY: number;
  rng: () => number;
  isMobile: boolean;
  detailScale: number;
  time: { value: number };
}

/**
 * 神谕核心状态（可与终局 boss 阶段联动）：
 * - online：常态，白青光柱、尖碑馈线、全息环；
 * - exposed：护盾瓦解，馈线熄灭、光柱减弱闪烁；
 * - overload：过载，光柱转为品红白、脉冲加剧，全息环高速旋转；
 * - offline：神谕陨落，光柱与全息环熄灭。
 */
export type CitadelCoreState = 'online' | 'exposed' | 'overload' | 'offline';

interface CoreLevels {
  beam: number;
  aura: number;
  feeds: number;
  holo: number;
  spin: number;
  overload: number;
  core: number;
}

const CORE_PRESETS: Record<CitadelCoreState, Readonly<CoreLevels>> = {
  online: { beam: 0.55, aura: 0.13, feeds: 0.75, holo: 0.7, spin: 1, overload: 0, core: 1 },
  exposed: { beam: 0.34, aura: 0.2, feeds: 0, holo: 0.35, spin: 0.5, overload: 0, core: 1.15 },
  overload: { beam: 0.85, aura: 0.32, feeds: 0, holo: 0.9, spin: 3, overload: 1, core: 1.4 },
  offline: { beam: 0, aura: 0, feeds: 0, holo: 0, spin: 0, overload: 0, core: 0.25 },
};

export interface FortressResult {
  group: THREE.Group;
  glows: GlowCard[];
  smoke: PuffEmitter[];
  steam: PuffEmitter[];
  /** 核心井中心上空（boss 决战区）世界坐标 */
  arena: THREE.Vector3;
  update(dt: number, elapsed: number): void;
  setCoreState(state: CitadelCoreState): void;
}

const TAU = Math.PI * 2;

/** 正多边形轮廓点（与 CylinderGeometry 同向：首顶点位于局部 +Z，rotation.y = yaw） */
function polygonPoints(radius: number, sides: number, yaw: number): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (let k = 0; k < sides; k++) {
    // 局部方位 φ（atan2 意义）= 90° - k·扇区；世界方位 = φ - yaw
    const angle = Math.PI / 2 - (k / sides) * TAU - yaw;
    points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }
  return points;
}

/** 水平环形面：外缘为多边形 / 圆，中心挖孔（多边形或圆），朝上 */
function flatRing(
  outer: Array<[number, number]>,
  inner: Array<[number, number]>,
  y: number,
  cx: number,
  cz: number
): THREE.BufferGeometry {
  // THREE.Shape 位于 XY 平面：x → 世界 x，y → 世界 -z（rotateX(-π/2) 之后）
  const shape = new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x, -z)));
  shape.holes.push(new THREE.Path(inner.map(([x, z]) => new THREE.Vector2(x, -z))));
  const geometry = new THREE.ShapeGeometry(shape, 1);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(cx, y, cz);
  return geometry;
}

function circlePoints(radius: number, segments: number): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (let k = 0; k < segments; k++) {
    const angle = (k / segments) * TAU;
    points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }
  return points;
}

function boxMesh(
  group: THREE.Group,
  material: THREE.Material,
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  yaw = 0
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = yaw;
  group.add(mesh);
  return mesh;
}

export function buildCitadelFortress(ctx: FortressContext): FortressResult {
  const { tokens, field, structures, waterY, rng } = ctx;
  const L = (local: number): number => waterY + local;
  const cx = CITADEL_CENTER.x;
  const cz = CITADEL_CENTER.z;
  const group = new THREE.Group();
  group.name = 'oracleCitadel';
  const glows: GlowCard[] = [];
  const smoke: PuffEmitter[] = [];
  const steam: PuffEmitter[] = [];

  /* ---------------- 材质 ---------------- */
  const obsidian = createObsidianMaterial(ctx.time, {
    color: tokens.structure,
    circuits: 0.9,
  });
  const obsidianDim = createObsidianMaterial(ctx.time, {
    color: new THREE.Color(tokens.structure).multiplyScalar(1.3),
    circuits: 0.3,
    gloss: 0.8,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: tokens.structureAccent,
    roughness: 0.48,
    metalness: 0.55,
    flatShading: true,
  });
  const deck = createDeckMaterial(
    ctx.time,
    new THREE.Color(tokens.structureAccent).multiplyScalar(0.8),
    CITADEL_CENTER
  );
  const magenta = createNeonMaterial(CITADEL_MAGENTA, 1.7);
  const cyan = createNeonMaterial(CITADEL_CYAN, 1.5);
  const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0xff2a1a });

  /* ---------------- 台基（挖去核心井） ---------------- */
  const daisYaw = Math.PI / 8;
  const daisLowSide = new THREE.Mesh(
    new THREE.CylinderGeometry(DAIS_OUTER, DAIS_OUTER, DAIS_LOW_TOP - 2, 8, 1, true),
    obsidianDim
  );
  daisLowSide.rotation.y = daisYaw;
  daisLowSide.position.set(cx, L(2 + (DAIS_LOW_TOP - 2) / 2), cz);
  group.add(daisLowSide);
  const daisSide = new THREE.Mesh(
    new THREE.CylinderGeometry(DAIS_INNER, DAIS_INNER, DAIS_TOP - DAIS_LOW_TOP + 2, 8, 1, true),
    obsidian
  );
  daisSide.rotation.y = daisYaw;
  daisSide.position.set(cx, L(DAIS_LOW_TOP - 2 + (DAIS_TOP - DAIS_LOW_TOP + 2) / 2), cz);
  group.add(daisSide);
  const outerOct = polygonPoints(DAIS_OUTER, 8, daisYaw);
  const innerOct = polygonPoints(DAIS_INNER, 8, daisYaw);
  group.add(new THREE.Mesh(flatRing(outerOct, innerOct, L(DAIS_LOW_TOP), cx, cz), deck));
  group.add(
    new THREE.Mesh(flatRing(innerOct, circlePoints(CURB_OUTER, 48), L(DAIS_TOP), cx, cz), deck)
  );
  structures.addAnnulus({
    x: cx,
    z: cz,
    sides: 8,
    yaw: daisYaw,
    outer: DAIS_OUTER,
    inner: WELL_RADIUS,
    top: L(DAIS_LOW_TOP),
  });
  structures.addAnnulus({
    x: cx,
    z: cz,
    sides: 8,
    yaw: daisYaw,
    outer: DAIS_INNER,
    inner: WELL_RADIUS,
    top: L(DAIS_TOP),
  });
  // 台基边缘霓虹线（上层品红、下层青色）：内收半个线宽，完全落在台面足迹之内
  const edgeInset = 0.5 / Math.cos(Math.PI / 8);
  for (const [points, y, material] of [
    [polygonPoints(DAIS_INNER - edgeInset, 8, daisYaw), L(DAIS_TOP) + 0.4, magenta],
    [polygonPoints(DAIS_OUTER - edgeInset, 8, daisYaw), L(DAIS_LOW_TOP) + 0.4, cyan],
  ] as const) {
    for (let k = 0; k < points.length; k++) {
      const [ax, az] = points[k];
      const [bx, bz] = points[(k + 1) % points.length];
      const length = Math.hypot(bx - ax, bz - az);
      boxMesh(
        group,
        material,
        length,
        0.8,
        0.8,
        cx + (ax + bx) / 2,
        y,
        cz + (az + bz) / 2,
        Math.atan2(-(bz - az), bx - ax)
      );
    }
  }

  /* ---------------- 坡道（正方向） ---------------- */
  for (const angle of CONDUIT_ANGLES) {
    const rMid = (RAMP_INNER + RAMP_OUTER) / 2;
    const halfLength = (RAMP_OUTER - RAMP_INNER) / 2;
    const x = cx + Math.cos(angle) * rMid;
    const z = cz + Math.sin(angle) * rMid;
    const yaw = Math.PI / 2 - angle;
    const geometry = new THREE.BoxGeometry(44, 1, halfLength * 2);
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      const lz = position.getZ(i);
      const top = position.getY(i) > 0;
      const t = (lz + halfLength) / (2 * halfLength);
      const yTop = L(DAIS_TOP) + (L(CRATER_FLOOR + 0.2) - L(DAIS_TOP)) * t;
      position.setY(i, top ? yTop : L(2));
    }
    geometry.computeVertexNormals();
    const ramp = new THREE.Mesh(geometry, metal);
    ramp.position.set(x, 0, z);
    ramp.rotation.y = yaw;
    group.add(ramp);
    structures.addRamp({
      x,
      z,
      halfX: 22,
      halfZ: halfLength,
      yaw,
      yStart: L(DAIS_TOP),
      yEnd: L(CRATER_FLOOR + 0.2),
    });
    // 坡道两侧品红边线（内收，落在坡道足迹之内）
    for (const side of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, halfLength * 2), magenta);
      edge.position.set(
        x + Math.cos(angle + Math.PI / 2) * 21.4 * side,
        (L(DAIS_TOP) + L(CRATER_FLOOR)) / 2 + 0.6,
        z + Math.sin(angle + Math.PI / 2) * 21.4 * side
      );
      edge.rotation.y = yaw;
      edge.rotation.x = Math.atan2(DAIS_TOP - CRATER_FLOOR, halfLength * 2);
      group.add(edge);
    }
  }

  /* ---------------- 城墙 + 角堡 + 城门灯柱塔 ---------------- */
  const wallVertices: Array<[number, number]> = [];
  for (let k = 0; k < 8; k++) {
    const angle = Math.PI / 8 + (k * Math.PI) / 4;
    wallVertices.push([cx + Math.cos(angle) * WALL_RADIUS, cz + Math.sin(angle) * WALL_RADIUS]);
  }
  const wallHeight = WALL_TOP - WALL_BASE;
  const addWallSegment = (ax: number, az: number, bx: number, bz: number): void => {
    const length = Math.hypot(bx - ax, bz - az);
    if (length < 4) return;
    const yaw = Math.atan2(-(bz - az), bx - ax);
    const mx = (ax + bx) / 2;
    const mz = (az + bz) / 2;
    boxMesh(
      group,
      obsidian,
      length,
      wallHeight,
      WALL_THICKNESS,
      mx,
      L(WALL_BASE + wallHeight / 2),
      mz,
      yaw
    );
    structures.addBox({
      x: mx,
      z: mz,
      halfX: length / 2,
      halfZ: WALL_THICKNESS / 2,
      yaw,
      top: L(WALL_TOP),
    });
    // 外侧扶壁与顶部饰带
    const outward = Math.atan2(mz - cz, mx - cx);
    const ox = Math.cos(outward);
    const oz = Math.sin(outward);
    const piers = Math.max(1, Math.floor(length / 38));
    for (let p = 0; p < piers; p++) {
      const t = (p + 0.5) / piers;
      const px = ax + (bx - ax) * t + ox * (WALL_THICKNESS / 2 + 2.5);
      const pz = az + (bz - az) * t + oz * (WALL_THICKNESS / 2 + 2.5);
      boxMesh(
        group,
        obsidianDim,
        7,
        wallHeight - 4,
        5,
        px,
        L(WALL_BASE + (wallHeight - 4) / 2),
        pz,
        yaw
      );
      structures.addBox({ x: px, z: pz, halfX: 3.5, halfZ: 2.5, yaw, top: L(WALL_TOP - 4) });
      // 竖向青色光缝
      boxMesh(group, cyan, 1.2, 14, 0.6, px + ox * 2.6, L(WALL_BASE + 18), pz + oz * 2.6, yaw);
    }
    boxMesh(
      group,
      magenta,
      length,
      1.1,
      0.7,
      mx + ox * (WALL_THICKNESS / 2 + 0.2),
      L(WALL_TOP - 3),
      mz + oz * (WALL_THICKNESS / 2 + 0.2),
      yaw
    );
    // 内侧墙顶青色光带 + 金属压顶
    boxMesh(
      group,
      cyan,
      length,
      0.7,
      0.6,
      mx - ox * (WALL_THICKNESS / 2 + 0.2),
      L(WALL_TOP - 1.6),
      mz - oz * (WALL_THICKNESS / 2 + 0.2),
      yaw
    );
    boxMesh(group, metal, length, 1.2, WALL_THICKNESS + 1.6, mx, L(WALL_TOP + 0.6), mz, yaw);
    structures.addBox({
      x: mx,
      z: mz,
      halfX: length / 2,
      halfZ: WALL_THICKNESS / 2 + 0.8,
      yaw,
      top: L(WALL_TOP + 1.2),
    });
  };
  for (let k = 0; k < 8; k++) {
    const [ax, az] = wallVertices[k];
    const [bx, bz] = wallVertices[(k + 1) % 8];
    const sideAngle = Math.atan2((az + bz) / 2 - cz, (ax + bx) / 2 - cx);
    const isGate = CONDUIT_ANGLES.some(
      (gate) => Math.abs(Math.atan2(Math.sin(sideAngle - gate), Math.cos(sideAngle - gate))) < 0.1
    );
    if (!isGate) {
      addWallSegment(ax, az, bx, bz);
      continue;
    }
    const length = Math.hypot(bx - ax, bz - az);
    const gateStart = (length - GATE_WIDTH) / 2 / length;
    const gateEnd = 1 - gateStart;
    const gx0 = ax + (bx - ax) * gateStart;
    const gz0 = az + (bz - az) * gateStart;
    const gx1 = ax + (bx - ax) * gateEnd;
    const gz1 = az + (bz - az) * gateEnd;
    addWallSegment(ax, az, gx0, gz0);
    addWallSegment(gx1, gz1, bx, bz);
    // 城门两侧灯柱塔
    const yaw = Math.atan2(-(bz - az), bx - ax);
    for (const [px, pz] of [
      [gx0, gz0],
      [gx1, gz1],
    ]) {
      boxMesh(group, obsidian, 20, 116, 20, px, L(WALL_BASE + 58), pz, yaw);
      structures.addBox({
        x: px,
        z: pz,
        halfX: 10.5,
        halfZ: 10.5,
        yaw,
        top: L(WALL_BASE + 118.2),
      });
      // 顶部：金属压顶 + 品红环带（无顶盖的四棱环，俯视不出现大块品红方片）
      boxMesh(group, metal, 21, 2.4, 21, px, L(WALL_BASE + 117), pz, yaw);
      const capBand = new THREE.Mesh(
        new THREE.CylinderGeometry(15.2, 15.2, 1.6, 4, 1, true),
        magenta
      );
      capBand.position.set(px, L(WALL_BASE + 114.6), pz);
      capBand.rotation.y = yaw + Math.PI / 4;
      group.add(capBand);
      // 两侧立面：三道竖向青色光缝
      for (const face of [-1, 1]) {
        for (const offset of [-6, 0, 6]) {
          boxMesh(
            group,
            cyan,
            1.4,
            84,
            1.3,
            px + Math.cos(yaw) * 10.2 * face - Math.sin(yaw) * offset,
            L(WALL_BASE + 52),
            pz - Math.sin(yaw) * 10.2 * face - Math.cos(yaw) * offset,
            yaw
          );
        }
      }
      glows.push({
        x: px,
        y: L(WALL_BASE + 120),
        z: pz,
        size: 30,
        color: CITADEL_MAGENTA,
        flicker: 0,
      });
    }
  }
  // 角堡
  const searchlightMounts: THREE.Vector3[] = [];
  wallVertices.forEach(([bx, bz], k) => {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 118 - WALL_BASE, 8), obsidian);
    body.position.set(bx, L(WALL_BASE + (118 - WALL_BASE) / 2), bz);
    body.rotation.y = daisYaw;
    group.add(body);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(20, 30, 16, 8), obsidianDim);
    crown.position.set(bx, L(126), bz);
    crown.rotation.y = daisYaw;
    group.add(crown);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(20, 36, 8), obsidian);
    spire.position.set(bx, L(134 + 18), bz);
    spire.rotation.y = daisYaw;
    group.add(spire);
    for (const y of [96, 114]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(30.5, 30.5, 1.4, 8, 1, true), magenta);
      band.position.set(bx, L(y), bz);
      band.rotation.y = daisYaw;
      group.add(band);
    }
    // 塔身 r = 30（品红环带 r = 30.5 只是薄环）
    structures.addFrustum({
      x: bx,
      z: bz,
      sides: 8,
      yaw: daisYaw,
      r0: 30.5,
      y0: L(WALL_BASE),
      y1: L(118),
    });
    structures.addFrustum({
      x: bx,
      z: bz,
      sides: 8,
      yaw: daisYaw,
      r0: 30,
      r1: 20,
      y0: L(118),
      y1: L(134),
      apex: 36,
    });
    glows.push({ x: bx, y: L(172), z: bz, size: 14, color: 0xff3a22, flicker: 0 });
    if (k % 2 === 0) searchlightMounts.push(new THREE.Vector3(bx, L(130), bz));
  });

  /* ---------------- 处理器大厅（对角方向） ---------------- */
  for (let k = 0; k < 4; k++) {
    const angle = Math.PI / 4 + (k * Math.PI) / 2;
    const x = cx + Math.cos(angle) * 250;
    const z = cz + Math.sin(angle) * 250;
    // 长轴沿切向：局部 +X = (-sin, cos) 方向
    const yaw = Math.atan2(-Math.cos(angle), -Math.sin(angle));
    boxMesh(group, obsidianDim, 104, 26, 38, x, L(DAIS_TOP + 13), z, yaw);
    boxMesh(group, metal, 84, 8, 24, x, L(DAIS_TOP + 30), z, yaw);
    structures.addBox({ x, z, halfX: 52, halfZ: 19, yaw, top: L(DAIS_TOP + 26) });
    structures.addBox({ x, z, halfX: 42, halfZ: 12, yaw, top: L(DAIS_TOP + 34) });
    for (const side of [-1, 1]) {
      const nx = Math.sin(yaw) * side;
      const nz = Math.cos(yaw) * side;
      boxMesh(group, cyan, 92, 1.6, 0.5, x + nx * 19.3, L(DAIS_TOP + 16), z + nz * 19.3, yaw);
      boxMesh(group, cyan, 92, 1.2, 0.5, x + nx * 19.3, L(DAIS_TOP + 9), z + nz * 19.3, yaw);
    }
    // 屋顶散热鳍片
    for (let f = -3; f <= 3; f++) {
      boxMesh(
        group,
        metal,
        2,
        6,
        20,
        x + Math.cos(yaw) * f * 11,
        L(DAIS_TOP + 37),
        z - Math.sin(yaw) * f * 11,
        yaw
      );
    }
  }

  /* ---------------- 导能尖碑 + 晶体 ---------------- */
  const crystals: THREE.Vector3[] = [];
  for (let k = 0; k < 4; k++) {
    const angle = Math.PI / 4 + (k * Math.PI) / 2;
    const x = cx + Math.cos(angle) * 165;
    const z = cz + Math.sin(angle) * 165;
    const yaw = Math.PI / 4 - angle;
    const height = 160;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(14, 31, height, 4, 1), obsidian);
    body.position.set(x, L(DAIS_TOP + height / 2), z);
    body.rotation.y = yaw;
    group.add(body);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(14, 30, 4), obsidianDim);
    tip.position.set(x, L(DAIS_TOP + height + 15), z);
    tip.rotation.y = yaw;
    group.add(tip);
    structures.addFrustum({
      x,
      z,
      sides: 4,
      yaw,
      r0: 31,
      r1: 14,
      y0: L(DAIS_TOP),
      y1: L(DAIS_TOP + height),
      apex: 30,
    });
    // 棱线上的青色导能线
    const base = new THREE.Vector3();
    const top = new THREE.Vector3();
    for (let e = 0; e < 4; e++) {
      const local = Math.PI / 2 - (e / 4) * TAU - yaw;
      base.set(x + Math.cos(local) * 31, L(DAIS_TOP), z + Math.sin(local) * 31);
      top.set(x + Math.cos(local) * 14, L(DAIS_TOP + height), z + Math.sin(local) * 14);
      const length = base.distanceTo(top);
      const line = new THREE.Mesh(new THREE.BoxGeometry(1.4, length, 1.4), cyan);
      line.position.copy(base).lerp(top, 0.5);
      line.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        top.clone().sub(base).normalize()
      );
      group.add(line);
    }
    const crystalY = L(DAIS_TOP + height + 42);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(10, 0), cyan);
    crystal.position.set(x, crystalY, z);
    crystal.scale.set(1, 1.6, 1);
    group.add(crystal);
    // 晶体上半为四棱锥（八面体赤道顶点位于 ±X / ±Z，与 4 边足迹同向）
    structures.addFrustum({
      x,
      z,
      sides: 4,
      r0: 10,
      r1: 10,
      y0: L(DAIS_TOP),
      y1: crystalY,
      apex: 16,
    });
    crystals.push(new THREE.Vector3(x, crystalY, z));
    glows.push({ x, y: crystalY, z, size: 80, color: CITADEL_CYAN, flicker: 2.5 });
  }

  /* ---------------- 核心井：井壁 / 井缘 / 电容柱 / 井底虹膜 / 核心 ---------------- */
  const wellWall = new THREE.Mesh(
    new THREE.CylinderGeometry(WELL_RADIUS, WELL_RADIUS, CURB_TOP - WELL_FLOOR, 48, 1, true),
    obsidian
  );
  wellWall.geometry.scale(-1, 1, 1); // 法线朝内
  wellWall.position.set(cx, L(WELL_FLOOR + (CURB_TOP - WELL_FLOOR) / 2), cz);
  group.add(wellWall);
  const curb = new THREE.Mesh(
    new THREE.CylinderGeometry(CURB_OUTER, CURB_OUTER, CURB_TOP - DAIS_TOP + 1, 48, 1, true),
    obsidianDim
  );
  curb.position.set(cx, L(DAIS_TOP + (CURB_TOP - DAIS_TOP) / 2), cz);
  group.add(curb);
  group.add(
    new THREE.Mesh(
      flatRing(circlePoints(CURB_OUTER, 48), circlePoints(WELL_RADIUS, 48), L(CURB_TOP), cx, cz),
      metal
    )
  );
  structures.addAnnulus({ x: cx, z: cz, outer: CURB_OUTER, inner: WELL_RADIUS, top: L(CURB_TOP) });
  for (const [radius, y] of [
    [WELL_RADIUS - 0.4, L(WELL_FLOOR + 10)],
    [WELL_RADIUS - 0.4, L(WELL_FLOOR + 20)],
    [CURB_OUTER + 0.2, L(CURB_TOP - 1.5)],
  ]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.6, 4, 64), cyan);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(cx, y, cz);
    group.add(ring);
  }
  for (let k = 0; k < 12; k++) {
    const angle = (k / 12) * TAU + 0.13;
    const x = cx + Math.cos(angle) * 130;
    const z = cz + Math.sin(angle) * 130;
    const yaw = -angle;
    boxMesh(group, obsidianDim, 9, 44, 9, x, L(DAIS_TOP + 22), z, yaw);
    boxMesh(group, cyan, 9.6, 2.4, 9.6, x, L(DAIS_TOP + 44), z, yaw);
    structures.addBox({ x, z, halfX: 4.8, halfZ: 4.8, yaw, top: L(DAIS_TOP + 45.2) });
    glows.push({ x, y: L(DAIS_TOP + 47), z, size: 18, color: CITADEL_CYAN, flicker: 3 });
  }
  const irisGeometry = new THREE.CircleGeometry(WELL_RADIUS, 64);
  irisGeometry.rotateX(-Math.PI / 2);
  // uv：以井心为原点的米数
  {
    const position = irisGeometry.getAttribute('position');
    const uv = irisGeometry.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      uv.setXY(i, position.getX(i), position.getZ(i));
    }
  }
  const iris = new THREE.Mesh(irisGeometry, createIrisMaterial(ctx.time));
  iris.position.set(cx, L(WELL_FLOOR), cz);
  iris.name = 'citadelCoreIris';
  structures.addFrustum({ x: cx, z: cz, r0: WELL_RADIUS, y0: L(WELL_FLOOR), y1: L(WELL_FLOOR) });
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xfff4e0).multiplyScalar(2.2),
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(26, 32, 18), coreMaterial);
  core.position.set(cx, L(WELL_FLOOR + 2), cz);
  core.name = 'citadelCore';
  core.userData.dynamic = true;
  // 核心球心 L(14)，呼吸 / 过载缩放至多 ×1.04
  structures.addDome({ x: cx, z: cz, radius: 27, base: L(WELL_FLOOR + 2), height: 27 });
  glows.push({ x: cx, y: L(WELL_FLOOR + 30), z: cz, size: 260, color: 0xfff0d8, flicker: 1.2 });
  glows.push({ x: cx, y: L(WELL_FLOOR + 60), z: cz, size: 420, color: CITADEL_CYAN, flicker: 0.6 });

  /* ---------------- 坑底：导管 / 路缘 / 发射柱 / 汲取站 ---------------- */
  const conduitGeometries: THREE.BufferGeometry[] = [];
  const postPositions: THREE.Vector3[] = [];
  for (const angle of CONDUIT_ANGLES) {
    const ux = Math.cos(angle);
    const uz = Math.sin(angle);
    const px = -uz;
    const pz = ux;
    const r0 = CONDUIT_INNER_RADIUS;
    const r1 = CONDUIT_OUTER_RADIUS;
    const segments = 24;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= segments; i++) {
      const r = r0 + ((r1 - r0) * i) / segments;
      for (const side of [-1, 1]) {
        const x = cx + ux * r + px * CONDUIT_HALF_WIDTH * side;
        const z = cz + uz * r + pz * CONDUIT_HALF_WIDTH * side;
        positions.push(x, L(field.sampleGround(x, z)) + 0.35, z);
        uvs.push(side, r);
      }
    }
    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    conduitGeometries.push(geometry.toNonIndexed());
    geometry.dispose();
    // 路缘
    const length = r1 - r0;
    const yaw = Math.PI / 2 - angle;
    for (const side of [-1, 1]) {
      const x = cx + ux * (r0 + length / 2) + px * (CONDUIT_HALF_WIDTH + 1.4) * side;
      const z = cz + uz * (r0 + length / 2) + pz * (CONDUIT_HALF_WIDTH + 1.4) * side;
      boxMesh(group, obsidianDim, 2.4, 2.6, length, x, L(CRATER_FLOOR + 1.3), z, yaw);
      boxMesh(group, magenta, 0.8, 0.5, length, x, L(CRATER_FLOOR + 2.7), z, yaw);
      structures.addBox({ x, z, halfX: 1.2, halfZ: length / 2, yaw, top: L(CRATER_FLOOR + 2.9) });
      for (let r = r0 + 40; r < r1; r += 70) {
        const postX = cx + ux * r + px * (CONDUIT_HALF_WIDTH + 6) * side;
        const postZ = cz + uz * r + pz * (CONDUIT_HALF_WIDTH + 6) * side;
        postPositions.push(new THREE.Vector3(postX, L(field.sampleGround(postX, postZ)), postZ));
      }
    }
    // 地热汲取站
    const hx = cx + ux * (r1 + 48);
    const hz = cz + uz * (r1 + 48);
    const hy = L(field.sampleGround(hx, hz));
    boxMesh(group, obsidian, 46, 30, 40, hx, hy + 13, hz, yaw);
    boxMesh(group, magenta, 30, 6, 1, hx - ux * 20.6, hy + 10, hz - uz * 20.6, yaw);
    structures.addBox({ x: hx, z: hz, halfX: 23, halfZ: 20, yaw, top: hy + 28 });
    for (const side of [-1, 1]) {
      const sx = hx + px * 14 * side + ux * 8;
      const sz = hz + pz * 14 * side + uz * 8;
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4, 44, 10), metal);
      stack.position.set(sx, hy + 22, sz);
      group.add(stack);
      structures.addFrustum({ x: sx, z: sz, r0: 4, y0: hy, y1: hy + 44 });
      steam.push({
        x: sx,
        y: hy + 44,
        z: sz,
        count: Math.max(4, Math.round(9 * ctx.detailScale)),
        life: 11,
        rise: 9,
        size: 9,
        growth: 3.4,
        spread: 6,
        color: 0x8a8098,
        colorJitter: 0.1,
      });
    }
    glows.push({
      x: hx - ux * 24,
      y: hy + 10,
      z: hz - uz * 24,
      size: 60,
      color: CITADEL_MAGENTA,
      flicker: 1.6,
    });
  }
  const posts = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(1.2, 1.6, 12, 6),
    metal,
    Math.max(1, postPositions.length)
  );
  posts.name = 'citadelConduitPosts';
  postPositions.forEach((p, i) => {
    setInstanceTransform(posts, i, p.x, p.y + 6, p.z, 0, 1);
    structures.addFrustum({ x: p.x, z: p.z, r0: 1.6, y0: p.y, y1: p.y + 13 });
    glows.push({ x: p.x, y: p.y + 13, z: p.z, size: 9, color: CITADEL_CYAN, flicker: 0 });
  });
  posts.count = postPositions.length;
  posts.instanceMatrix.needsUpdate = true;
  group.add(posts);

  /* ---------------- 黑色数据方碑 ---------------- */
  const monolithCount = Math.round(26 * Math.max(0.6, ctx.detailScale));
  let placedMonoliths = 0;
  for (let attempt = 0; attempt < 400 && placedMonoliths < monolithCount; attempt++) {
    const angle = rng() * TAU;
    const nearConduit = CONDUIT_ANGLES.some(
      (gate) => Math.abs(Math.atan2(Math.sin(angle - gate), Math.cos(angle - gate))) < 0.13
    );
    if (nearConduit) continue;
    const r = 560 + rng() * 460;
    const x = cx + Math.cos(angle) * r;
    const z = cz + Math.sin(angle) * r;
    if (field.riftEdgeDistance(x, z) < 34) continue;
    if (Math.hypot(x, z) < 160) continue; // 出生点附近留空
    const ground = L(field.sampleGround(x, z));
    const height = 26 + rng() * 26;
    const yaw = rng() * Math.PI;
    boxMesh(group, obsidian, 9, height, 2.6, x, ground + height / 2 - 1, z, yaw);
    boxMesh(group, cyan, 0.7, height * 0.8, 2.7, x, ground + height * 0.45, z, yaw);
    structures.addBox({ x, z, halfX: 4.5, halfZ: 1.35, yaw, top: ground + height - 1 });
    placedMonoliths++;
  }

  /* ---------------- 坑缘雷达防空阵地 ---------------- */
  for (let k = 0; k < 8; k++) {
    const angle = (k / 8) * TAU + Math.PI / 8;
    const r = field.rimRadius(angle) * 0.985;
    const x = cx + Math.cos(angle) * r;
    const z = cz + Math.sin(angle) * r;
    const ground = L(field.sampleGround(x, z));
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(15, 16, 8, 0, TAU, 0, Math.PI / 2),
      obsidianDim
    );
    dome.position.set(x, ground - 1, z);
    group.add(dome);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.6, 40, 6), metal);
    mast.position.set(x + 18, ground + 19, z);
    group.add(mast);
    structures.addDome({ x, z, radius: 15, base: ground - 1, height: 15 });
    structures.addFrustum({ x: x + 18, z, r0: 1.8, y0: ground, y1: ground + 40 });
    glows.push({ x: x + 18, y: ground + 41, z, size: 12, color: 0xff3a22, flicker: 0 });
  }

  /* ---------------- 航标灯 ---------------- */
  const beaconPositions = wallVertices.map(([x, z]) => new THREE.Vector3(x, L(171), z));
  const beacons = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1.8, 8, 6),
    beaconMaterial,
    beaconPositions.length
  );
  beacons.name = 'citadelBeacons';
  beaconPositions.forEach((p, i) => setInstanceTransform(beacons, i, p.x, p.y, p.z, 0, 1));
  beacons.instanceMatrix.needsUpdate = true;
  group.add(beacons);

  mergeStaticMeshes(group);
  // 黑曜石与金属结构投射 / 接收阴影（霓虹与灯带不参与）
  const shadowMaterials = new Set<THREE.Material>([obsidian, obsidianDim, metal]);
  group.traverse((object) => {
    if (object instanceof THREE.Mesh && shadowMaterials.has(object.material as THREE.Material)) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  /* ---------------- 动态 / 透明层（合批之后加入） ---------------- */
  group.add(iris, core);
  const conduit = conduitGeometries.length > 0 ? mergeConduits(conduitGeometries) : null;
  if (conduit) {
    const mesh = new THREE.Mesh(conduit, createConduitMaterial(ctx.time));
    mesh.name = 'citadelConduits';
    group.add(mesh);
  }

  // 核心光柱（白青核心 + 品红外晕）
  const beamHeight = BEAM_TOP - L(WELL_FLOOR);
  const beamMaterial = createBeamMaterial(ctx.time, {
    core: 0xf4fbff,
    fringe: CITADEL_CYAN,
    intensity: 0.55,
    pulseScale: 0.004,
    pulseDepth: 0.2,
    fadeStart: 1400,
    fadeEnd: BEAM_TOP,
  });
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 11, beamHeight, 24, 1, true),
    beamMaterial
  );
  beam.position.set(cx, L(WELL_FLOOR) + beamHeight / 2, cz);
  beam.name = 'citadelCoreBeam';
  beam.renderOrder = 0;
  group.add(beam);
  const auraMaterial = createBeamMaterial(ctx.time, {
    core: CITADEL_MAGENTA,
    fringe: 0x6a1a8a,
    intensity: 0.13,
    pulseScale: 0.002,
    fadeStart: 300,
    fadeEnd: L(WELL_FLOOR) + beamHeight * 0.55,
  });
  const aura = new THREE.Mesh(
    new THREE.CylinderGeometry(28, 34, beamHeight * 0.55, 24, 1, true),
    auraMaterial
  );
  aura.position.set(cx, L(WELL_FLOOR) + (beamHeight * 0.55) / 2, cz);
  aura.name = 'citadelCoreAura';
  aura.renderOrder = 0;
  group.add(aura);

  // 尖碑晶体 → 光柱的能量馈线
  const feedMaterial = createBeamMaterial(ctx.time, {
    core: 0xe8fbff,
    fringe: CITADEL_CYAN,
    intensity: 0.75,
    pulseScale: 0.03,
    fadeStart: 4000,
    fadeEnd: 5000,
  });
  const feedTarget = new THREE.Vector3(cx, FEED_Y, cz);
  const feedGeometries: THREE.BufferGeometry[] = [];
  const feedMatrix = new THREE.Matrix4();
  const feedQuaternion = new THREE.Quaternion();
  const feedMid = new THREE.Vector3();
  const feedScale = new THREE.Vector3(1, 1, 1);
  for (const crystal of crystals) {
    const length = crystal.distanceTo(feedTarget);
    const geometry = new THREE.CylinderGeometry(1.6, 1.6, length, 8, 1, true);
    feedMid.copy(crystal).lerp(feedTarget, 0.5);
    feedQuaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      feedTarget.clone().sub(crystal).normalize()
    );
    geometry.applyMatrix4(feedMatrix.compose(feedMid, feedQuaternion, feedScale));
    feedGeometries.push(geometry);
  }
  const feedGeometry = mergeGeometries(feedGeometries, false);
  feedGeometries.forEach((geometry) => geometry.dispose());
  const feeds = new THREE.Mesh(feedGeometry ?? new THREE.BufferGeometry(), feedMaterial);
  feeds.name = 'citadelFeedBeams';
  feeds.renderOrder = 0;
  group.add(feeds);

  // 全息数据环（三层，交错旋转）
  const holoMaterial = createBeamMaterial(ctx.time, {
    core: CITADEL_CYAN,
    fringe: CITADEL_MAGENTA,
    intensity: 0.7,
    pulseScale: 0.05,
    fadeStart: 4000,
    fadeEnd: 5000,
  });
  const holoRings: THREE.Mesh[] = [];
  [
    [78, 300],
    [96, 336],
    [62, 372],
  ].forEach(([radius, y], i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 1.3, 6, 96), holoMaterial);
    ring.position.set(cx, y, cz);
    ring.rotation.x = Math.PI / 2 + (i - 1) * 0.18;
    ring.renderOrder = 0;
    group.add(ring);
    holoRings.push(ring);
  });

  // 探照灯（四座角堡）
  const searchlightMaterial = createSearchlightMaterial(0xcfe8ff);
  const searchlights: Array<{ pivot: THREE.Object3D; phase: number }> = [];
  searchlightMounts.forEach((mount, i) => {
    const pivot = new THREE.Object3D();
    pivot.position.copy(mount);
    // 窄端（底部，uv.y = 0）位于灯头，向上张开
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(46, 0.8, 820, 20, 1, true),
      searchlightMaterial
    );
    cone.position.y = 410;
    cone.renderOrder = 0;
    const tilt = new THREE.Object3D();
    tilt.rotation.z = 0.5;
    tilt.add(cone);
    pivot.add(tilt);
    group.add(pivot);
    searchlights.push({ pivot, phase: i * 1.7 });
  });

  // 熔岩裂谷烟气由环境统一合批（返回发射源）
  for (const rift of field.rifts) {
    for (let i = 1; i < rift.points.length; i += 3) {
      const [x, z] = rift.points[i];
      smoke.push({
        x,
        y: L(CRATER_FLOOR),
        z,
        count: Math.max(3, Math.round(6 * ctx.detailScale)),
        life: 14,
        rise: 7,
        size: 16,
        growth: 3.2,
        spread: 14,
        color: 0x2e2632,
        colorJitter: 0.2,
      });
    }
  }

  const beaconOn = new THREE.Color(0xff2a1a);
  const beaconOff = new THREE.Color(0x3a0806);
  const coreBase = coreMaterial.color.clone();
  const coreHot = new THREE.Color(0xff7ab0).multiplyScalar(2.4);
  // 核心状态：逐帧向目标值平滑过渡（约 1.5 秒）
  const beamCore = (beamMaterial.uniforms.uCore.value as THREE.Color).clone();
  const beamFringe = (beamMaterial.uniforms.uFringe.value as THREE.Color).clone();
  const overloadCore = new THREE.Color(0xffd0e8).multiplyScalar(1.6);
  const overloadFringe = new THREE.Color(CITADEL_MAGENTA).multiplyScalar(1.3);
  const levels: CoreLevels = { ...CORE_PRESETS.online };
  let target: Readonly<CoreLevels> = CORE_PRESETS.online;
  let holoPhase = 0;
  const update = (dt: number, elapsed: number): void => {
    const blend = 1 - Math.exp(-dt * 2);
    for (const key of Object.keys(levels) as Array<keyof CoreLevels>) {
      levels[key] += (target[key] - levels[key]) * blend;
    }
    holoPhase += dt * levels.spin;
    holoRings.forEach((ring, i) => {
      ring.rotation.z = holoPhase * (0.12 + i * 0.05) * (i % 2 === 0 ? 1 : -1);
    });
    for (const light of searchlights) {
      light.pivot.rotation.y = elapsed * 0.22 + light.phase;
    }
    // 护盾瓦解后的光柱闪烁（exposed：beam 低于常态时）
    const unstable = Math.max(0, Math.min(1, (CORE_PRESETS.online.beam - levels.beam) * 6));
    const flicker =
      1 - unstable * 0.3 * (0.5 + 0.5 * Math.sin(elapsed * 23) * Math.sin(elapsed * 7.3));
    beamMaterial.uniforms.uIntensity.value = levels.beam * flicker;
    beamMaterial.uniforms.uPulseDepth.value = 0.2 + 0.45 * levels.overload;
    (beamMaterial.uniforms.uCore.value as THREE.Color)
      .copy(beamCore)
      .lerp(overloadCore, levels.overload);
    (beamMaterial.uniforms.uFringe.value as THREE.Color)
      .copy(beamFringe)
      .lerp(overloadFringe, levels.overload);
    auraMaterial.uniforms.uIntensity.value = levels.aura;
    feedMaterial.uniforms.uIntensity.value = levels.feeds;
    holoMaterial.uniforms.uIntensity.value = levels.holo;
    beam.visible = levels.beam > 0.003;
    aura.visible = levels.aura > 0.003;
    feeds.visible = levels.feeds > 0.003;
    for (const ring of holoRings) ring.visible = levels.holo > 0.003;
    const rate = 2.4 + 6 * levels.overload;
    const pulse = 0.85 + 0.15 * Math.sin(elapsed * rate);
    coreMaterial.color
      .copy(coreBase)
      .lerp(coreHot, levels.overload)
      .multiplyScalar(pulse * levels.core);
    core.scale.setScalar((0.97 + 0.03 * Math.sin(elapsed * rate)) * (0.9 + 0.1 * levels.core));
    beaconMaterial.color.copy(Math.sin(elapsed * 2.8) > 0.25 ? beaconOn : beaconOff);
  };
  update(0, 0);

  return {
    group,
    glows,
    smoke,
    steam,
    arena: new THREE.Vector3(cx, 160, cz),
    update,
    setCoreState(state: CitadelCoreState) {
      target = CORE_PRESETS[state] ?? CORE_PRESETS.online;
    },
  };
}

function mergeConduits(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let total = 0;
  for (const geometry of geometries) total += geometry.getAttribute('position').count;
  const positions = new Float32Array(total * 3);
  const uvs = new Float32Array(total * 2);
  let offset = 0;
  for (const geometry of geometries) {
    const p = geometry.getAttribute('position').array as Float32Array;
    const u = geometry.getAttribute('uv').array as Float32Array;
    positions.set(p, offset * 3);
    uvs.set(u, offset * 2);
    offset += geometry.getAttribute('position').count;
    geometry.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.computeBoundingSphere();
  return merged;
}
