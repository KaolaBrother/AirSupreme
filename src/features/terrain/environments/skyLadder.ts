/**
 * 天梯轨道电梯：
 * - 主干：直插近地轨道的光纤主干（深色装甲外壳 + 12 道光纤槽，青色数据脉冲向上奔流，
 *   每第四道槽是神谕的红色上传数据）；每隔一段的套环、两条爬升导轨与升降舱（神谕的红色舱正缓缓上爬）；
 * - 六根收分支柱自云海拔起，撑住高空的六边形“光环”平台（辐条连回主干）；
 * - 六条斜拉索把光环拉向战场边缘的六座锚塔；云海上零星的中继天线。
 * 竖直柱体（主干 / 导轨 / 支柱 / 锚塔 / 天线）登记为精确足迹；光环、辐条、拉索全部在 y ≥ 640，
 * 处于软顶界之上，不参与柱状采样。
 */
import * as THREE from 'three';
import type { SceneDesignTokens } from '../LevelConfig';
import { GLSL_NOISE, mergeStaticMeshes, setInstanceTransform } from './envKit';
import { createGlowCards, type GlowCard } from './lavaMaterials';
import type { StructureField } from './structureField';
import {
  ANCHOR_TOP_Y,
  HALO_Y,
  PYLON_RING_RADIUS,
  SKY_LADDER_CENTER,
  TRUNK_RADIUS,
  skyLadderLayout,
} from './StratosphereField';

/** 主干实际渲染到的高度（超出相机远裁剪面，看上去直通天顶） */
const TRUNK_RENDER_TOP = 7000;
const TRUNK_BOTTOM = -95;
const RAIL_OFFSET = 46;

export interface SkyLadderContext {
  tokens: SceneDesignTokens;
  structures: StructureField;
  /** 云顶世界高度采样（中继天线落脚） */
  deckAt: (x: number, z: number) => number;
  rng: () => number;
  isMobile: boolean;
  time: { value: number };
}

export interface SkyLadderResult {
  group: THREE.Group;
  /** 主干底部（云海入口）世界坐标：云团环绕用 */
  trunkBase: THREE.Vector3;
  update(dt: number, elapsed: number): void;
}

/** 世界高度驱动的发光环带（支柱 / 锚塔）：按水平距离计雾，竖直结构上下雾化一致 */
function injectStructureBands(
  material: THREE.MeshStandardMaterial,
  time: { value: number },
  bandColor: THREE.Color,
  spacing: number,
  cacheKey: string
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBandTime = time;
    shader.uniforms.uBandColor = { value: bandColor };
    shader.uniforms.uBandSpacing = { value: spacing };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBandWorld;')
      .replace(
        '#include <fog_vertex>',
        `#include <fog_vertex>
        {
          vec4 bandWorld = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            bandWorld = instanceMatrix * bandWorld;
          #endif
          vBandWorld = (modelMatrix * bandWorld).xyz;
          #ifdef USE_FOG
            vFogDepth = length(vBandWorld.xz - cameraPosition.xz);
          #endif
        }`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uBandTime;
        uniform vec3 uBandColor;
        uniform float uBandSpacing;
        varying vec3 vBandWorld;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float bandPhase = fract(vBandWorld.y / uBandSpacing);
          float band = smoothstep(0.955, 0.975, bandPhase) * (1.0 - smoothstep(0.985, 1.0, bandPhase));
          float travel = 0.55 + 0.45 * sin(vBandWorld.y * 0.02 - uBandTime * 2.2);
          totalEmissiveRadiance += uBandColor * band * travel * 2.2;
        }`
      );
  };
  material.customProgramCacheKey = () => `sky-ladder-bands:${cacheKey}`;
}

/** 主干外壳：12 道光纤槽，脉冲沿槽向上奔流（每第四道为神谕红色数据）；按水平距离计雾 */
function injectTrunkFibers(
  material: THREE.MeshStandardMaterial,
  time: { value: number },
  cyan: THREE.Color,
  red: THREE.Color
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFiberTime = time;
    shader.uniforms.uFiberCyan = { value: cyan };
    shader.uniforms.uFiberRed = { value: red };
    shader.uniforms.uFiberCenter = {
      value: new THREE.Vector2(SKY_LADDER_CENTER.x, SKY_LADDER_CENTER.z),
    };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFiberWorld;')
      .replace(
        '#include <fog_vertex>',
        `#include <fog_vertex>
        vFiberWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #ifdef USE_FOG
          vFogDepth = length(vFiberWorld.xz - cameraPosition.xz);
        #endif`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uFiberTime;
        uniform vec3 uFiberCyan;
        uniform vec3 uFiberRed;
        uniform vec2 uFiberCenter;
        varying vec3 vFiberWorld;
        ${GLSL_NOISE}`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec2 fiberRel = vFiberWorld.xz - uFiberCenter;
          float fiberAngle = atan(fiberRel.y, fiberRel.x) / 6.2831853 + 0.5;
          float fiberSlot = fiberAngle * 12.0;
          float fiberIndex = floor(fiberSlot);
          float fiberLocal = fract(fiberSlot);
          float groove = smoothstep(0.38, 0.45, fiberLocal) * (1.0 - smoothstep(0.55, 0.62, fiberLocal));
          bool oracle = mod(fiberIndex, 4.0) < 0.5;
          float speed = oracle ? 0.16 : 0.32;
          float phase = fract(vFiberWorld.y * 0.0032 - uFiberTime * speed + envHash12(vec2(fiberIndex, 3.0)));
          float pulse = smoothstep(0.0, 0.03, phase) * (1.0 - smoothstep(0.03, 0.16, phase));
          vec3 fiberColor = oracle ? uFiberRed : uFiberCyan;
          totalEmissiveRadiance += fiberColor * groove * (0.35 + pulse * 3.2);
        }`
      );
  };
  material.customProgramCacheKey = () => 'sky-ladder-trunk';
}

function beamBetween(
  group: THREE.Group,
  material: THREE.Material,
  a: THREE.Vector3,
  b: THREE.Vector3,
  width: number,
  height: number
): void {
  const length = a.distanceTo(b);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, length), material);
  mesh.position.copy(a).lerp(b, 0.5);
  mesh.lookAt(b);
  group.add(mesh);
}

function cableBetween(
  group: THREE.Group,
  material: THREE.Material,
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number
): void {
  const length = a.distanceTo(b);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 6, 1, true),
    material
  );
  mesh.position.copy(a).lerp(b, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  group.add(mesh);
}

export function buildSkyLadder(ctx: SkyLadderContext): SkyLadderResult {
  const { tokens, structures, rng } = ctx;
  const group = new THREE.Group();
  group.name = 'skyLadder';
  const glows: GlowCard[] = [];
  const cx = SKY_LADDER_CENTER.x;
  const cz = SKY_LADDER_CENTER.z;
  const glowCyan = new THREE.Color(tokens.glow);

  /* ---------------- 材质 ---------------- */
  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a303c,
    roughness: 0.36,
    metalness: 0.62,
  });
  injectTrunkFibers(
    trunkMaterial,
    ctx.time,
    glowCyan.clone().multiplyScalar(1.4),
    new THREE.Color(0xff3a4a).multiplyScalar(1.6)
  );
  const hullMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(tokens.structure).lerp(new THREE.Color(0x9aa8c0), 0.45),
    roughness: 0.36,
    metalness: 0.38,
  });
  injectStructureBands(hullMaterial, ctx.time, glowCyan.clone(), 70, 'hull');
  const darkMetal = new THREE.MeshStandardMaterial({
    color: tokens.structureAccent,
    roughness: 0.5,
    metalness: 0.6,
  });
  injectStructureBands(darkMetal, ctx.time, glowCyan.clone().multiplyScalar(0.6), 120, 'dark');
  const cableMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a3f4c,
    roughness: 0.6,
    metalness: 0.5,
  });
  const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  const windowMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xffe2b0).multiplyScalar(1.2),
  });

  /* ---------------- 主干 / 套环 / 导轨 ---------------- */
  const trunkHeight = TRUNK_RENDER_TOP - TRUNK_BOTTOM;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(TRUNK_RADIUS, TRUNK_RADIUS, trunkHeight, 24, 1, true),
    trunkMaterial
  );
  trunk.position.set(cx, TRUNK_BOTTOM + trunkHeight / 2, cz);
  trunk.name = 'skyLadderTrunk';
  group.add(trunk);
  const collarHeights: number[] = [];
  for (let y = 40; y <= 1400; y += 120) collarHeights.push(y);
  collarHeights.push(1700, 2100, 2600, 3200, 4000, 5000, 6200);
  for (const y of collarHeights) {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(37, 37, 9, 24), darkMetal);
    collar.position.set(cx, y, cz);
    group.add(collar);
    for (let k = 0; k < 4; k++) {
      const angle = (k / 4) * Math.PI * 2 + 0.4;
      glows.push({
        x: cx + Math.cos(angle) * 38,
        y,
        z: cz + Math.sin(angle) * 38,
        size: y < 1500 ? 16 : 40,
        color: tokens.glow,
        flicker: 0,
      });
    }
  }
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(7, trunkHeight, 7), hullMaterial);
    rail.position.set(cx + side * RAIL_OFFSET, TRUNK_BOTTOM + trunkHeight / 2, cz);
    group.add(rail);
    structures.addBox({
      x: cx + side * RAIL_OFFSET,
      z: cz,
      halfX: 4,
      halfZ: 4,
      top: TRUNK_RENDER_TOP,
    });
  }
  // 主干 + 套环为一根柱体
  structures.addFrustum({ x: cx, z: cz, r0: 38, y0: TRUNK_BOTTOM, y1: TRUNK_RENDER_TOP });

  /* ---------------- 支柱 / 光环 / 辐条 ---------------- */
  const layout = skyLadderLayout();
  const pylonBottom = -75;
  const pylonTop = HALO_Y + 12;
  const haloVertices: THREE.Vector3[] = [];
  for (const pylon of layout.pylons) {
    const height = pylonTop - pylonBottom;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(13, 24, height, 8, 1), hullMaterial);
    mesh.position.set(pylon.x, pylonBottom + height / 2, pylon.z);
    group.add(mesh);
    // 足迹含 1.3 米的分段套箍外沿
    structures.addFrustum({
      x: pylon.x,
      z: pylon.z,
      sides: 8,
      r0: 25.3,
      r1: 14.3,
      y0: pylonBottom,
      y1: pylonTop,
    });
    haloVertices.push(new THREE.Vector3(pylon.x, HALO_Y, pylon.z));
    // 分段套箍：与发光环带错开，打破光滑柱身
    for (let y = 35; y < pylonTop - 30; y += 140) {
      const r = 24 - (11 * (y - pylonBottom)) / height + 1.3;
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 5, 8), darkMetal);
      collar.position.set(pylon.x, y, pylon.z);
      group.add(collar);
    }
    // 支柱侧面的航标灯
    for (let y = 60; y < pylonTop - 20; y += 140) {
      const r = 24 - (11 * (y - pylonBottom)) / height + 0.6;
      glows.push({
        x: pylon.x + Math.cos(pylon.angle) * r,
        y,
        z: pylon.z + Math.sin(pylon.angle) * r,
        size: 9,
        color: 0xff3a22,
        flicker: 0,
      });
    }
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(56, 64, 64, 24), darkMetal);
  hub.position.set(cx, HALO_Y - 4, cz);
  group.add(hub);
  for (let k = 0; k < haloVertices.length; k++) {
    const a = haloVertices[k];
    const b = haloVertices[(k + 1) % haloVertices.length];
    beamBetween(group, hullMaterial, a, b, 34, 22);
    beamBetween(
      group,
      darkMetal,
      new THREE.Vector3(cx, HALO_Y + 6, cz),
      a.clone().setY(HALO_Y + 6),
      12,
      12
    );
    // 光环底面灯带
    for (let t = 0.15; t < 0.9; t += 0.18) {
      const p = a.clone().lerp(b, t);
      glows.push({ x: p.x, y: HALO_Y - 13, z: p.z, size: 22, color: 0xd8f4ff, flicker: 0 });
    }
    // 顶部天线
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2, 46, 6), darkMetal);
    mast.position.set(a.x, HALO_Y + 34, a.z);
    group.add(mast);
    glows.push({ x: a.x, y: HALO_Y + 58, z: a.z, size: 14, color: 0xff3a22, flicker: 0 });
  }

  /* ---------------- 斜拉索 + 锚塔 ---------------- */
  for (let k = 0; k < layout.anchors.length; k++) {
    const anchor = layout.anchors[k];
    const height = ANCHOR_TOP_Y - pylonBottom;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(11, 20, height, 8, 1), hullMaterial);
    tower.position.set(anchor.x, pylonBottom + height / 2, anchor.z);
    group.add(tower);
    const block = new THREE.Mesh(new THREE.BoxGeometry(26, 30, 26), darkMetal);
    block.position.set(anchor.x, ANCHOR_TOP_Y - 6, anchor.z);
    block.rotation.y = -anchor.angle;
    group.add(block);
    structures.addFrustum({
      x: anchor.x,
      z: anchor.z,
      sides: 8,
      r0: 20,
      r1: 11,
      y0: pylonBottom,
      y1: ANCHOR_TOP_Y,
    });
    structures.addFrustum({
      x: anchor.x,
      z: anchor.z,
      r0: 13,
      y0: pylonBottom,
      y1: ANCHOR_TOP_Y + 9,
    });
    const from = haloVertices[k].clone().setY(HALO_Y + 4);
    const to = new THREE.Vector3(anchor.x, ANCHOR_TOP_Y + 4, anchor.z);
    cableBetween(group, cableMaterial, from, to, 2.4);
    glows.push({
      x: anchor.x,
      y: ANCHOR_TOP_Y + 12,
      z: anchor.z,
      size: 18,
      color: 0xff3a22,
      flicker: 0,
    });
    for (let y = 80; y < ANCHOR_TOP_Y - 40; y += 150) {
      glows.push({ x: anchor.x, y, z: anchor.z, size: 30, color: tokens.glow, flicker: 0 });
    }
  }

  /* ---------------- 中继天线 ---------------- */
  const relays: THREE.Vector3[] = [];
  for (let attempt = 0; attempt < 200 && relays.length < (ctx.isMobile ? 6 : 9); attempt++) {
    const angle = rng() * Math.PI * 2;
    const radius = 280 + rng() * 1080;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (Math.hypot(x - cx, z - cz) < PYLON_RING_RADIUS + 160) continue;
    if (layout.anchors.some((a) => Math.hypot(a.x - x, a.z - z) < 160)) continue;
    if (relays.some((r) => Math.hypot(r.x - x, r.z - z) < 260)) continue;
    const base = ctx.deckAt(x, z) - 6;
    const height = 130 + rng() * 170;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 4.2, height, 6), darkMetal);
    mast.position.set(x, base + height / 2, z);
    group.add(mast);
    for (const fraction of [0.45, 0.75]) {
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 2, 10), hullMaterial);
      dish.position.set(x, base + height * fraction, z);
      group.add(dish);
    }
    structures.addFrustum({ x, z, sides: 0, r0: 6.2, y0: base, y1: base + height + 3 });
    relays.push(new THREE.Vector3(x, base + height + 3, z));
    glows.push({ x, y: base + height + 3, z, size: 12, color: 0xff3a22, flicker: 0 });
  }

  /* ---------------- 航标灯（统一闪烁） ---------------- */
  const beaconPositions = [...relays, ...haloVertices.map((v) => v.clone().setY(HALO_Y + 58))];
  const beacons = new THREE.InstancedMesh(
    new THREE.SphereGeometry(2.2, 8, 6),
    beaconMaterial,
    Math.max(1, beaconPositions.length)
  );
  beacons.name = 'skyLadderBeacons';
  beaconPositions.forEach((p, i) => setInstanceTransform(beacons, i, p.x, p.y, p.z, 0, 1));
  beacons.count = beaconPositions.length;
  beacons.instanceMatrix.needsUpdate = true;
  group.add(beacons);

  mergeStaticMeshes(group);

  /* ---------------- 升降舱（动态） ---------------- */
  const carGeometry = new THREE.BoxGeometry(18, 28, 12);
  const cars = new THREE.InstancedMesh(carGeometry, darkMetal, 2);
  cars.name = 'skyLadderClimbers';
  cars.frustumCulled = false;
  group.add(cars);
  const carWindows = new THREE.InstancedMesh(new THREE.BoxGeometry(19, 3, 13), windowMaterial, 2);
  carWindows.name = 'skyLadderClimberWindows';
  carWindows.frustumCulled = false;
  group.add(carWindows);
  const climberGlowStart = glows.length;
  glows.push({ x: cx - RAIL_OFFSET, y: 0, z: cz, size: 70, color: 0xff3040, flicker: 1.2 });
  glows.push({ x: cx + RAIL_OFFSET, y: 0, z: cz, size: 46, color: 0xfff0d0, flicker: 0 });

  const trunkBase = new THREE.Vector3(cx, ctx.deckAt(cx + 60, cz), cz);
  const glowCards = createGlowCards(glows, 'skyLadderGlow', 0.9);
  group.add(glowCards.mesh);
  const glowAttribute = glowCards.mesh.geometry.getAttribute(
    'aCard'
  ) as THREE.InstancedBufferAttribute;

  const update = (_dt: number, elapsed: number): void => {
    // 神谕的红色舱：十分钟内自云海缓缓爬向轨道；货运舱在下段往返
    const oracleY = 60 + Math.min(1, elapsed / 600) * 3900;
    const cargoY = 60 + (0.5 - 0.5 * Math.cos((elapsed / 90) * Math.PI * 2)) * 1100;
    setInstanceTransform(cars, 0, cx - RAIL_OFFSET - 9, oracleY, cz, 0, 1);
    setInstanceTransform(cars, 1, cx + RAIL_OFFSET + 9, cargoY, cz, 0, 1);
    setInstanceTransform(carWindows, 0, cx - RAIL_OFFSET - 9, oracleY + 6, cz, 0, 1);
    setInstanceTransform(carWindows, 1, cx + RAIL_OFFSET + 9, cargoY + 6, cz, 0, 1);
    cars.instanceMatrix.needsUpdate = true;
    carWindows.instanceMatrix.needsUpdate = true;
    glowAttribute.setY(climberGlowStart, oracleY);
    glowAttribute.setY(climberGlowStart + 1, cargoY);
    glowAttribute.needsUpdate = true;
    glowCards.update(elapsed);
    beaconMaterial.color.setHex(Math.sin(elapsed * 2.6) > 0.2 ? 0xff2a1a : 0x3a0806);
  };
  update(0, 0);

  return { group, trunkBase, update };
}
