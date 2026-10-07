/**
 * 神谕锻炉：赤炎火山岛上的敌方兵工厂。
 * 冷却塔（双曲面、带烟垢色带与蒸汽）、高炉（炉身 + 热风炉 + 烟囱 + 炉口火光与渣池）、
 * 锯齿屋顶厂房（红色窗带）、矿石输送栈桥（移动的炽热矿锭）、储罐、管廊、
 * 嵌在火山坡上的熔炉炉口与火炬塔；航空障碍灯统一闪烁。
 * 只构建几何；烟/汽/火的发射源与辉光点返回给 VolcanoEnvironment 统一合批。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { SceneDesignTokens } from '../LevelConfig';
import { setInstanceTransform, type PuffEmitter } from './envKit';
import type { GlowCard } from './lavaMaterials';
import { VOLCANO_MAIN_CONE } from './VolcanoField';

export interface FoundryContext {
  tokens: SceneDesignTokens;
  /** 世界坐标地表高度（含熔岩面） */
  groundAt: (x: number, z: number) => number;
  rng: () => number;
  detailScale: number;
}

export interface FoundryBuildResult {
  group: THREE.Group;
  smoke: PuffEmitter[];
  steam: PuffEmitter[];
  fire: PuffEmitter[];
  glows: GlowCard[];
  animate(elapsed: number): void;
}

interface Placement {
  x: number;
  z: number;
  rotation?: number;
}

const COOLING_TOWERS: ReadonlyArray<Placement & { height: number }> = [
  { x: 800, z: -530, height: 108 },
  { x: 872, z: -420, height: 118 },
  { x: 770, z: -390, height: 94 },
];

const SMELTERS: readonly Placement[] = [
  { x: 590, z: -505, rotation: 0.3 },
  { x: 660, z: -430, rotation: 1.1 },
  { x: 540, z: -580, rotation: 2.2 },
  { x: 700, z: -585, rotation: -0.6 },
];

const HALLS: readonly Placement[] = [
  { x: 610, z: -330, rotation: 0.32 },
  { x: 505, z: -455, rotation: 1.25 },
  { x: 735, z: -680, rotation: -0.28 },
];

/** 嵌入主火山坡面的熔炉炉口（方位角，度） */
const PORTAL_ANGLES = [15, 45, 110, 200, 250, 320];
const PORTAL_RADIUS = 405;

function portalPosition(angleDeg: number): { x: number; z: number; outward: number } {
  const angle = THREE.MathUtils.degToRad(angleDeg);
  return {
    x: VOLCANO_MAIN_CONE.x + Math.cos(angle) * PORTAL_RADIUS,
    z: VOLCANO_MAIN_CONE.z + Math.sin(angle) * PORTAL_RADIUS,
    outward: angle,
  };
}

/** 双曲面冷却塔轮廓（Lathe 点） */
function coolingTowerProfile(height: number, baseRadius: number, waistRadius: number): THREE.Vector2[] {
  const waistY = height * 0.72;
  const c = waistY / Math.sqrt((baseRadius / waistRadius) ** 2 - 1);
  const points: THREE.Vector2[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const y = (i / steps) * height;
    const r = waistRadius * Math.sqrt(1 + ((y - waistY) / c) ** 2);
    points.push(new THREE.Vector2(r, y));
  }
  return points;
}

export function buildVolcanoFoundry(ctx: FoundryContext): FoundryBuildResult {
  const { tokens, groundAt, rng } = ctx;
  const group = new THREE.Group();
  group.name = 'volcanoFoundry';
  const smoke: PuffEmitter[] = [];
  const steam: PuffEmitter[] = [];
  const fire: PuffEmitter[] = [];
  const glows: GlowCard[] = [];

  /* ---------------- 材质 ---------------- */
  const steel = new THREE.MeshStandardMaterial({
    color: tokens.structure,
    roughness: 0.55,
    metalness: 0.65,
  });
  const rust = new THREE.MeshStandardMaterial({
    color: tokens.structureAccent,
    roughness: 0.82,
    metalness: 0.3,
  });
  const concrete = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const padMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a3634,
    roughness: 0.96,
    metalness: 0.05,
  });
  const furnace = new THREE.MeshStandardMaterial({
    color: 0x1a0a04,
    emissive: new THREE.Color(0xff4a0a),
    emissiveIntensity: 1.5,
    roughness: 0.6,
  });
  const windowStrip = new THREE.MeshBasicMaterial({ color: 0xff5a26 });
  const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  const oreMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a1006,
    emissive: new THREE.Color(0xff7a22),
    emissiveIntensity: 2.2,
    roughness: 0.7,
  });

  const beacons: THREE.Vector3[] = [];

  /* ---------------- 混凝土场坪与道路（从高空读出人造轮廓） ---------------- */
  const pads: Array<{ x: number; z: number; w: number; d: number; r: number }> = [
    { x: 650, z: -470, w: 330, d: 230, r: 0.32 },
    { x: 560, z: -640, w: 170, d: 120, r: 0.1 },
    { x: 820, z: -470, w: 150, d: 260, r: 0.2 },
  ];
  for (const pad of pads) {
    const y = groundAt(pad.x, pad.z);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(pad.w, 6, pad.d), padMaterial);
    slab.position.set(pad.x, y - 1.5, pad.z);
    slab.rotation.y = pad.r;
    slab.receiveShadow = true;
    group.add(slab);
  }

  /* ---------------- 冷却塔 ---------------- */
  const sootColor = new THREE.Color(0x1d1a19);
  const concreteColor = new THREE.Color(0x6a625d);
  const rustBand = new THREE.Color(tokens.structureAccent);
  for (const tower of COOLING_TOWERS) {
    const baseRadius = tower.height * 0.34;
    const waistRadius = tower.height * 0.21;
    const geometry = new THREE.LatheGeometry(
      coolingTowerProfile(tower.height, baseRadius, waistRadius),
      28
    );
    const positions = geometry.getAttribute('position');
    const colors = new Float32Array(positions.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
      const t = positions.getY(i) / tower.height;
      c.copy(concreteColor).lerp(sootColor, THREE.MathUtils.smoothstep(t, 0.72, 1));
      const band = Math.abs(t - 0.18) < 0.025 ? 0.6 : 0;
      c.lerp(rustBand, band);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const shell = new THREE.Mesh(geometry, concrete);
    const y = groundAt(tower.x, tower.z) - 3;
    shell.position.set(tower.x, y, tower.z);
    shell.castShadow = true;
    shell.receiveShadow = true;
    group.add(shell);
    steam.push({
      x: tower.x,
      y: y + tower.height - 4,
      z: tower.z,
      count: Math.max(6, Math.round(16 * ctx.detailScale)),
      life: 13,
      rise: 9,
      size: waistRadius * 1.3,
      growth: 3.4,
      spread: waistRadius,
      color: 0x7a746e,
      colorJitter: 0.1,
    });
    const topRadius = waistRadius * 1.12;
    for (let b = 0; b < 3; b++) {
      const angle = (b / 3) * Math.PI * 2 + 0.4;
      beacons.push(
        new THREE.Vector3(
          tower.x + Math.cos(angle) * topRadius,
          y + tower.height + 1.2,
          tower.z + Math.sin(angle) * topRadius
        )
      );
    }
  }

  /* ---------------- 高炉 ---------------- */
  const stoveCount = SMELTERS.length * 3;
  const stoves = new THREE.InstancedMesh(new THREE.CylinderGeometry(5, 5.5, 30, 10), rust, stoveCount);
  const stoveDomes = new THREE.InstancedMesh(
    new THREE.SphereGeometry(5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    rust,
    stoveCount
  );
  stoves.name = 'foundryHotStoves';
  let stoveIndex = 0;
  for (const smelter of SMELTERS) {
    const rotation = smelter.rotation ?? 0;
    const y = groundAt(smelter.x, smelter.z) - 2;
    const unit = new THREE.Group();
    unit.position.set(smelter.x, y, smelter.z);
    unit.rotation.y = rotation;

    const body = new THREE.Mesh(new THREE.CylinderGeometry(10, 13.5, 50, 14), steel);
    body.position.y = 25;
    body.castShadow = true;
    unit.add(body);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(11, 16, 14), rust);
    hood.position.y = 58;
    unit.add(hood);
    const bustle = new THREE.Mesh(new THREE.TorusGeometry(13, 2.2, 6, 18), rust);
    bustle.position.y = 16;
    bustle.rotation.x = Math.PI / 2;
    unit.add(bustle);
    for (let d = 0; d < 2; d++) {
      const downcomer = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 40, 8), steel);
      downcomer.position.set(d === 0 ? 9 : -9, 52, 6);
      downcomer.rotation.z = d === 0 ? -0.5 : 0.5;
      unit.add(downcomer);
    }
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.2, 54, 10), steel);
    stack.position.set(-20, 27, -8);
    stack.castShadow = true;
    unit.add(stack);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(9, 7, 2), furnace);
    mouth.position.set(0, 5, 13);
    unit.add(mouth);
    const slag = new THREE.Mesh(new THREE.CircleGeometry(9, 16), furnace);
    slag.rotation.x = -Math.PI / 2;
    slag.position.set(0, 0.8, 26);
    unit.add(slag);
    group.add(unit);
    unit.updateMatrixWorld(true);

    const stackTop = new THREE.Vector3(-20, 56, -8).applyMatrix4(unit.matrixWorld);
    smoke.push({
      x: stackTop.x,
      y: stackTop.y,
      z: stackTop.z,
      count: Math.max(5, Math.round(12 * ctx.detailScale)),
      life: 12,
      rise: 9,
      size: 7,
      growth: 4.2,
      spread: 6,
      color: 0x2a2524,
      colorJitter: 0.2,
    });
    beacons.push(new THREE.Vector3(-20, 55, -8).applyMatrix4(unit.matrixWorld));
    const mouthWorld = new THREE.Vector3(0, 6, 18).applyMatrix4(unit.matrixWorld);
    glows.push({ x: mouthWorld.x, y: mouthWorld.y, z: mouthWorld.z, size: 34, color: 0xff6a1a, flicker: 3 });
    const slagWorld = new THREE.Vector3(0, 4, 26).applyMatrix4(unit.matrixWorld);
    glows.push({ x: slagWorld.x, y: slagWorld.y, z: slagWorld.z, size: 30, color: 0xff4a10, flicker: 2 });

    for (let s = 0; s < 3; s++) {
      const local = new THREE.Vector3(22 + s * 11, 0, -14).applyMatrix4(unit.matrixWorld);
      setInstanceTransform(stoves, stoveIndex, local.x, local.y + 15, local.z, 0, 1);
      setInstanceTransform(stoveDomes, stoveIndex, local.x, local.y + 30, local.z, 0, 1);
      stoveIndex++;
    }
  }
  stoves.instanceMatrix.needsUpdate = true;
  stoveDomes.instanceMatrix.needsUpdate = true;
  group.add(stoves, stoveDomes);

  /* ---------------- 锯齿屋顶厂房 ---------------- */
  const toothShape = new THREE.Shape();
  toothShape.moveTo(0, 0);
  toothShape.lineTo(16, 0);
  toothShape.lineTo(16, 9);
  toothShape.closePath();
  const teeth: THREE.BufferGeometry[] = [];
  for (let t = 0; t < 6; t++) {
    const tooth = new THREE.ExtrudeGeometry(toothShape, { depth: 40, bevelEnabled: false });
    tooth.translate(-48 + t * 16, 0, -20);
    teeth.push(tooth);
  }
  const roofGeometry = mergeGeometries(teeth);
  teeth.forEach((tooth) => tooth.dispose());
  for (const hall of HALLS) {
    const y = groundAt(hall.x, hall.z) - 2;
    const building = new THREE.Group();
    building.position.set(hall.x, y, hall.z);
    building.rotation.y = hall.rotation ?? 0;
    const body = new THREE.Mesh(new THREE.BoxGeometry(96, 22, 40), steel);
    body.position.y = 11;
    body.castShadow = true;
    body.receiveShadow = true;
    building.add(body);
    const roof = new THREE.Mesh(roofGeometry, rust);
    roof.position.y = 22;
    building.add(roof);
    for (const side of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(84, 2.2, 0.6), windowStrip);
      strip.position.set(0, 14, side * 20.3);
      building.add(strip);
    }
    group.add(building);
  }

  /* ---------------- 储罐 ---------------- */
  const tankCount = 9;
  const tanks = new THREE.InstancedMesh(new THREE.CylinderGeometry(9, 9, 15, 16), steel, tankCount);
  const tankDomes = new THREE.InstancedMesh(
    new THREE.SphereGeometry(9, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    rust,
    tankCount
  );
  tanks.name = 'foundryTanks';
  for (let i = 0; i < tankCount; i++) {
    const angle = (i / tankCount) * Math.PI * 1.4 + 0.2;
    const x = 560 + Math.cos(angle) * 70 + (rng() - 0.5) * 8;
    const z = -660 + Math.sin(angle) * 40 + (rng() - 0.5) * 8;
    const y = groundAt(x, z);
    const scale = 0.8 + rng() * 0.45;
    setInstanceTransform(tanks, i, x, y + 7.5 * scale - 1, z, 0, scale);
    setInstanceTransform(tankDomes, i, x, y + 15 * scale - 1, z, 0, scale);
  }
  tanks.instanceMatrix.needsUpdate = true;
  tankDomes.instanceMatrix.needsUpdate = true;
  group.add(tanks, tankDomes);

  /* ---------------- 管廊：高炉 → 冷却塔 ---------------- */
  const pipeRuns: Array<[number, number, number, number]> = [
    [590, -505, 800, -530],
    [660, -430, 770, -390],
    [700, -585, 872, -420],
  ];
  for (const [ax, az, bx, bz] of pipeRuns) {
    const ay = groundAt(ax, az) + 12;
    const by = groundAt(bx, bz) + 12;
    const start = new THREE.Vector3(ax, ay, az);
    const end = new THREE.Vector3(bx, by, bz);
    const length = start.distanceTo(end);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, length, 8), rust);
    pipe.position.copy(start).lerp(end, 0.5);
    pipe.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      end.clone().sub(start).normalize()
    );
    group.add(pipe);
  }

  /* ---------------- 坡面熔炉炉口 ---------------- */
  for (const angleDeg of PORTAL_ANGLES) {
    const portal = portalPosition(angleDeg);
    const y = groundAt(portal.x, portal.z);
    const frame = new THREE.Group();
    frame.position.set(portal.x, y - 4, portal.z);
    // 炉口朝外（背向火山中心）
    frame.rotation.y = Math.PI / 2 - portal.outward;
    const pillarGeometry = new THREE.BoxGeometry(5, 34, 6);
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(pillarGeometry, steel);
      pillar.position.set(side * 17, 17, 0);
      frame.add(pillar);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(40, 6, 7), rust);
    lintel.position.set(0, 34, 0);
    frame.add(lintel);
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(29, 30), furnace);
    inner.position.set(0, 15, -2.5);
    frame.add(inner);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(44, 3, 14), steel);
    sill.position.set(0, 1.5, 4);
    frame.add(sill);
    group.add(frame);
    frame.updateMatrixWorld(true);
    const glowAt = new THREE.Vector3(0, 16, 8).applyMatrix4(frame.matrixWorld);
    glows.push({ x: glowAt.x, y: glowAt.y, z: glowAt.z, size: 70, color: 0xff5a14, flicker: 1.2 });
    const smokeAt = new THREE.Vector3(0, 36, 2).applyMatrix4(frame.matrixWorld);
    smoke.push({
      x: smokeAt.x,
      y: smokeAt.y,
      z: smokeAt.z,
      count: Math.max(3, Math.round(6 * ctx.detailScale)),
      life: 10,
      rise: 7,
      size: 9,
      growth: 3.5,
      spread: 8,
      color: 0x2f2826,
      colorJitter: 0.2,
    });
    beacons.push(new THREE.Vector3(-17, 35, 0).applyMatrix4(frame.matrixWorld));
    beacons.push(new THREE.Vector3(17, 35, 0).applyMatrix4(frame.matrixWorld));
  }

  /* ---------------- 矿石输送栈桥（炉口 → 高炉，炽热矿锭移动） ---------------- */
  const conveyorRuns: Array<{ from: { x: number; z: number }; to: { x: number; z: number } }> = [
    { from: portalPosition(15), to: { x: 700, z: -585 } },
    { from: portalPosition(45), to: { x: 590, z: -505 } },
    { from: { x: 660, z: -430 }, to: { x: 610, z: -330 } },
  ];
  const legGeometry = new THREE.BoxGeometry(2.4, 1, 2.4);
  const legCountEstimate = 64;
  const legs = new THREE.InstancedMesh(legGeometry, steel, legCountEstimate);
  legs.name = 'conveyorLegs';
  let legIndex = 0;
  const ingotsPerRun = Math.max(6, Math.round(14 * ctx.detailScale));
  const ingots = new THREE.InstancedMesh(
    new THREE.BoxGeometry(4, 2.2, 6),
    oreMaterial,
    ingotsPerRun * conveyorRuns.length
  );
  ingots.name = 'conveyorIngots';
  const ingotPaths: Array<{ start: THREE.Vector3; end: THREE.Vector3; yaw: number }> = [];
  for (const run of conveyorRuns) {
    const start = new THREE.Vector3(run.from.x, groundAt(run.from.x, run.from.z) + 14, run.from.z);
    const end = new THREE.Vector3(run.to.x, groundAt(run.to.x, run.to.z) + 20, run.to.z);
    const direction = end.clone().sub(start);
    const length = direction.length();
    direction.normalize();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(7, 3, length), steel);
    deck.position.copy(start).lerp(end, 0.5);
    deck.lookAt(end);
    deck.castShadow = true;
    group.add(deck);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1, 3.2, length), rust);
    rail.position.copy(deck.position);
    rail.quaternion.copy(deck.quaternion);
    rail.translateX(3.6);
    rail.translateY(2.4);
    group.add(rail);
    const yaw = Math.atan2(direction.x, direction.z);
    ingotPaths.push({ start, end, yaw });
    const legSpacing = 28;
    const legCount = Math.max(1, Math.floor(length / legSpacing));
    for (let l = 1; l < legCount && legIndex < legCountEstimate; l++) {
      const t = l / legCount;
      const x = start.x + (end.x - start.x) * t;
      const z = start.z + (end.z - start.z) * t;
      const top = start.y + (end.y - start.y) * t;
      const ground = groundAt(x, z);
      const height = Math.max(2, top - ground);
      setInstanceTransform(legs, legIndex++, x, ground + height / 2, z, yaw, 1, height, 1);
    }
  }
  legs.count = legIndex;
  legs.instanceMatrix.needsUpdate = true;
  group.add(legs, ingots);

  /* ---------------- 火炬塔 ---------------- */
  const flares: Array<{ x: number; z: number; height: number }> = [
    { x: 900, z: -610, height: 70 },
    { x: 470, z: -620, height: 58 },
  ];
  for (const flare of flares) {
    const y = groundAt(flare.x, flare.z);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, flare.height, 8), steel);
    mast.position.set(flare.x, y + flare.height / 2, flare.z);
    group.add(mast);
    fire.push({
      x: flare.x,
      y: y + flare.height + 2,
      z: flare.z,
      count: Math.max(6, Math.round(12 * ctx.detailScale)),
      life: 1.6,
      rise: 9,
      size: 6,
      growth: 1.6,
      spread: 3,
      color: 0xff7a26,
      colorJitter: 0.3,
    });
    glows.push({ x: flare.x, y: y + flare.height + 6, z: flare.z, size: 46, color: 0xff8a2a, flicker: 6 });
    beacons.push(new THREE.Vector3(flare.x, y + flare.height * 0.6, flare.z));
  }

  /* ---------------- 场区照明灯杆（暖黄灯光，夜色中勾勒厂区轮廓） ---------------- */
  const lampCount = 16;
  const lampPoles = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.5, 0.7, 1, 6),
    steel,
    lampCount
  );
  lampPoles.name = 'foundryLampPoles';
  for (let i = 0; i < lampCount; i++) {
    const pad = pads[i % pads.length];
    const angle = (i / lampCount) * Math.PI * 2 + rng() * 0.3;
    const x = pad.x + Math.cos(angle) * pad.w * 0.42;
    const z = pad.z + Math.sin(angle) * pad.d * 0.42;
    const ground = groundAt(x, z);
    const height = 16 + rng() * 6;
    setInstanceTransform(lampPoles, i, x, ground + height / 2, z, 0, 1, height, 1);
    glows.push({ x, y: ground + height + 1, z, size: 16, color: 0xffc27a, flicker: 0 });
  }
  lampPoles.instanceMatrix.needsUpdate = true;
  group.add(lampPoles);

  /* ---------------- 航空障碍灯（统一闪烁） ---------------- */
  const beaconMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1.4, 8, 6),
    beaconMaterial,
    Math.max(1, beacons.length)
  );
  beaconMesh.name = 'foundryBeacons';
  beacons.forEach((beacon, i) => {
    setInstanceTransform(beaconMesh, i, beacon.x, beacon.y, beacon.z, 0, 1);
    glows.push({ x: beacon.x, y: beacon.y, z: beacon.z, size: 9, color: 0xff2a1a, flicker: 0 });
  });
  beaconMesh.count = beacons.length;
  beaconMesh.instanceMatrix.needsUpdate = true;
  group.add(beaconMesh);

  /* ---------------- 动画：矿锭沿栈桥移动、障碍灯闪烁 ---------------- */
  const tmp = new THREE.Vector3();
  const beaconOn = new THREE.Color(0xff2a1a);
  const beaconOff = new THREE.Color(0x3a0806);
  const animate = (elapsed: number): void => {
    let index = 0;
    for (const path of ingotPaths) {
      for (let i = 0; i < ingotsPerRun; i++) {
        const t = (i / ingotsPerRun + elapsed * 0.018) % 1;
        tmp.copy(path.start).lerp(path.end, t);
        setInstanceTransform(ingots, index++, tmp.x, tmp.y + 2.6, tmp.z, path.yaw, 1);
      }
    }
    ingots.instanceMatrix.needsUpdate = true;
    beaconMaterial.color.copy(Math.sin(elapsed * 3.1) > 0.25 ? beaconOn : beaconOff);
  };
  animate(0);

  return { group, smoke, steam, fire, glows, animate };
}
