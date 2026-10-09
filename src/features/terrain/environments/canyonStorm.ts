/**
 * 雷霆收集网：神谕在雷鸣峡谷崖缘上架设的特斯拉收集塔（格构塔身 + 绝缘子 + 发光环形线圈 +
 * 避雷针 + 电容器组 + 控制小屋）与「雷霆」飞艇系泊塔；以及环境自带的雷击表现：
 * - 云底 → 塔尖的分叉闪电（屏幕朝向的带状闪电，加色、带核心高光）；
 * - 雷击后线圈充能暴涨，并在峡谷两岸成对的塔之间拉出噼啪跳动的电弧；
 * - 闪光：点光源 + 公告板辉光 + 写入共享闪光 uniform（河面 / 云底被照亮）。
 * 塔、电容、小屋的足迹登记进 StructureField（采样 = 柱体顶面）。
 */
import * as THREE from 'three';
import type { SceneDesignTokens } from '../LevelConfig';
import { mergeStaticMeshes, setInstanceTransform, type PuffEmitter } from './envKit';
import { createGlowCards, type GlowCard } from './lavaMaterials';
import { BoltRibbons, createPath, jaggedPath } from './lightning';
import type { CanyonFlashUniforms } from './canyonMaterials';
import type { StructureField } from './structureField';

export interface TowerSite {
  x: number;
  z: number;
  /** 塔基地面世界高度 */
  groundY: number;
  /** 成对放电的另一座塔（索引），-1 = 无 */
  partner: number;
  /** 塔身高度（米） */
  height: number;
}

export interface CanyonStormContext {
  tokens: SceneDesignTokens;
  structures: StructureField;
  flash: CanyonFlashUniforms;
  sites: readonly TowerSite[];
  mooring: { x: number; z: number; groundY: number } | null;
  /** 雷暴云底世界高度（闪电起点） */
  ceilingY: number;
  rng: () => number;
  isMobile: boolean;
}

export interface CanyonStormResult {
  group: THREE.Group;
  glows: GlowCard[];
  steam: PuffEmitter[];
  update(dt: number, elapsed: number): void;
}

/* ------------------------------------------------------------------ */
/* 塔架几何                                                            */
/* ------------------------------------------------------------------ */

function beam(
  group: THREE.Group,
  material: THREE.Material,
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number
): void {
  const length = a.distanceTo(b);
  if (length < 0.01) return;
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 5, 1, true),
    material
  );
  mesh.position.copy(a).lerp(b, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  group.add(mesh);
}

/** 四柱格构塔身（逐渐收分）+ 水平横撑 + X 形斜撑 */
function latticeMast(
  group: THREE.Group,
  material: THREE.Material,
  baseHalf: number,
  topHalf: number,
  height: number,
  levels: number
): void {
  const corner = (half: number, y: number, sx: number, sz: number): THREE.Vector3 =>
    new THREE.Vector3(sx * half, y, sz * half);
  const signs: Array<[number, number]> = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  for (const [sx, sz] of signs) {
    beam(group, material, corner(baseHalf, 0, sx, sz), corner(topHalf, height, sx, sz), 0.75);
  }
  for (let level = 0; level < levels; level++) {
    const y0 = (level / levels) * height;
    const y1 = ((level + 1) / levels) * height;
    const h0 = baseHalf + (topHalf - baseHalf) * (level / levels);
    const h1 = baseHalf + (topHalf - baseHalf) * ((level + 1) / levels);
    for (let s = 0; s < 4; s++) {
      const [ax, az] = signs[s];
      const [bx, bz] = signs[(s + 1) % 4];
      beam(group, material, corner(h1, y1, ax, az), corner(h1, y1, bx, bz), 0.35);
      beam(group, material, corner(h0, y0, ax, az), corner(h1, y1, bx, bz), 0.28);
      beam(group, material, corner(h0, y0, bx, bz), corner(h1, y1, ax, az), 0.28);
    }
  }
}

export function buildCanyonStorm(ctx: CanyonStormContext): CanyonStormResult {
  const { tokens, structures, rng } = ctx;
  const group = new THREE.Group();
  group.name = 'canyonStormGrid';
  const glows: GlowCard[] = [];
  const steam: PuffEmitter[] = [];

  const steel = new THREE.MeshStandardMaterial({
    color: new THREE.Color(tokens.structure).multiplyScalar(0.9),
    roughness: 0.55,
    metalness: 0.6,
  });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x5a5452, roughness: 0.95 });
  const ceramic = new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.4 });
  const glowColor = new THREE.Color(tokens.glow);
  const coilMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a2a3a,
    emissive: glowColor,
    emissiveIntensity: 1.6,
    roughness: 0.3,
    metalness: 0.4,
  });
  const windowMaterial = new THREE.MeshBasicMaterial({
    color: glowColor.clone().multiplyScalar(1.3),
  });
  const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0xff2a1a });

  const coilTips: THREE.Vector3[] = [];
  const spikeTips: THREE.Vector3[] = [];
  const beacons: THREE.Vector3[] = [];

  ctx.sites.forEach((site) => {
    const tower = new THREE.Group();
    tower.position.set(site.x, site.groundY, site.z);
    tower.rotation.y = rng() * Math.PI;
    const h = site.height;

    const pad = new THREE.Mesh(new THREE.BoxGeometry(22, 4, 22), concrete);
    pad.position.y = 0.5;
    tower.add(pad);
    const mast = new THREE.Group();
    mast.position.y = 2.5;
    latticeMast(mast, steel, 7.5, 2, h - 6, ctx.isMobile ? 5 : 7);
    tower.add(mast);
    // 绝缘子串 + 环形线圈 + 避雷针
    const insulator = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 8, 8), ceramic);
    insulator.position.y = h;
    tower.add(insulator);
    for (let r = 0; r < 4; r++) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.6, 10), ceramic);
      disc.position.y = h - 2.6 + r * 1.8;
      tower.add(disc);
    }
    const coil = new THREE.Mesh(new THREE.TorusGeometry(8.5, 2.3, 8, 26), coilMaterial);
    coil.rotation.x = Math.PI / 2;
    coil.position.y = h + 5.5;
    tower.add(coil);
    const innerCoil = new THREE.Mesh(new THREE.TorusGeometry(5.2, 1.3, 6, 20), coilMaterial);
    innerCoil.rotation.x = Math.PI / 2;
    innerCoil.position.y = h + 9;
    tower.add(innerCoil);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.8, 14, 6), steel);
    spike.position.y = h + 16;
    tower.add(spike);

    // 电容器组 + 控制小屋
    for (let c = 0; c < 3; c++) {
      const angle = (c / 3) * Math.PI * 2 + 0.6;
      const cx = Math.cos(angle) * 22;
      const cz = Math.sin(angle) * 22;
      const can = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3, 9, 10), steel);
      can.position.set(cx, 4.5, cz);
      tower.add(can);
      for (let r = 0; r < 2; r++) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.35, 5, 14), coilMaterial);
        band.rotation.x = Math.PI / 2;
        band.position.set(cx, 3 + r * 4, cz);
        tower.add(band);
      }
    }
    const hut = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 8), concrete);
    hut.position.set(-6, 3, 26);
    tower.add(hut);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(9, 1.2, 0.4), windowMaterial);
    strip.position.set(-6, 4, 30.2);
    tower.add(strip);
    group.add(tower);
    tower.updateMatrixWorld(true);

    const coilTip = new THREE.Vector3(0, h + 5.5, 0).applyMatrix4(tower.matrixWorld);
    const spikeTip = new THREE.Vector3(0, h + 23, 0).applyMatrix4(tower.matrixWorld);
    coilTips.push(coilTip);
    spikeTips.push(spikeTip);
    beacons.push(new THREE.Vector3(0, h - 1, 0).applyMatrix4(tower.matrixWorld));
    glows.push({
      x: coilTip.x,
      y: coilTip.y,
      z: coilTip.z,
      size: 46,
      color: tokens.glow,
      flicker: 9,
    });
    glows.push({
      x: coilTip.x,
      y: coilTip.y + 4,
      z: coilTip.z,
      size: 24,
      color: 0xe8f4ff,
      flicker: 14,
    });
    for (let c = 0; c < 3; c++) {
      const angle = (c / 3) * Math.PI * 2 + 0.6;
      const p = new THREE.Vector3(Math.cos(angle) * 22, 7, Math.sin(angle) * 22).applyMatrix4(
        tower.matrixWorld
      );
      glows.push({ x: p.x, y: p.y, z: p.z, size: 12, color: tokens.glow, flicker: 4 });
    }

    // 足迹：塔身 + 线圈（半径 11）为柱体；电容器组与小屋
    structures.addFrustum({
      x: site.x,
      z: site.z,
      r0: 11,
      y0: site.groundY,
      y1: site.groundY + h + 9,
    });
    structures.addFrustum({ x: site.x, z: site.z, r0: 1.2, y0: site.groundY, y1: spikeTip.y });
    structures.addBox({
      x: site.x,
      z: site.z,
      halfX: 11,
      halfZ: 11,
      top: site.groundY + 2.5,
      yaw: tower.rotation.y,
    });
    for (let c = 0; c < 3; c++) {
      const angle = (c / 3) * Math.PI * 2 + 0.6;
      const p = new THREE.Vector3(Math.cos(angle) * 22, 0, Math.sin(angle) * 22).applyMatrix4(
        tower.matrixWorld
      );
      structures.addFrustum({ x: p.x, z: p.z, r0: 3, y0: site.groundY, y1: site.groundY + 9 });
    }
    const hutWorld = new THREE.Vector3(-6, 0, 26).applyMatrix4(tower.matrixWorld);
    structures.addBox({
      x: hutWorld.x,
      z: hutWorld.z,
      halfX: 6,
      halfZ: 4,
      yaw: tower.rotation.y,
      top: site.groundY + 6,
    });
  });

  // 「雷霆」飞艇系泊塔：高耸格构塔 + 系泊锥 + 旋转航标
  let mooringBeacon: THREE.Object3D | null = null;
  if (ctx.mooring) {
    const m = ctx.mooring;
    const mast = new THREE.Group();
    mast.position.set(m.x, m.groundY, m.z);
    const height = 96;
    const base = new THREE.Mesh(new THREE.BoxGeometry(26, 5, 26), concrete);
    base.position.y = 1;
    mast.add(base);
    const lattice = new THREE.Group();
    lattice.position.y = 3.5;
    latticeMast(lattice, steel, 9, 3, height, ctx.isMobile ? 6 : 9);
    mast.add(lattice);
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(6, 4, 4, 10), steel);
    deck.position.y = height + 4;
    mast.add(deck);
    const cup = new THREE.Mesh(new THREE.ConeGeometry(4.5, 9, 10, 1, true), coilMaterial);
    cup.position.y = height + 10;
    cup.rotation.x = Math.PI;
    mast.add(cup);
    const head = new THREE.Group();
    head.position.y = height + 15;
    head.userData.dynamic = true;
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(5, 1.6, 1.6), beaconMaterial);
    lamp.position.x = 2.5;
    head.add(lamp);
    mast.add(head);
    mooringBeacon = head;
    group.add(mast);
    beacons.push(new THREE.Vector3(m.x, m.groundY + height + 15, m.z));
    glows.push({
      x: m.x,
      y: m.groundY + height + 10,
      z: m.z,
      size: 30,
      color: tokens.glow,
      flicker: 3,
    });
    structures.addFrustum({
      x: m.x,
      z: m.z,
      r0: 13,
      r1: 7,
      y0: m.groundY,
      y1: m.groundY + height + 18,
    });
  }

  // 航空障碍灯
  if (beacons.length > 0) {
    const beaconMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1.2, 8, 6),
      beaconMaterial,
      beacons.length
    );
    beaconMesh.name = 'canyonBeacons';
    beacons.forEach((b, i) => {
      setInstanceTransform(beaconMesh, i, b.x, b.y, b.z, 0, 1);
      glows.push({ x: b.x, y: b.y, z: b.z, size: 10, color: 0xff3a22, flicker: 0 });
    });
    beaconMesh.instanceMatrix.needsUpdate = true;
    group.add(beaconMesh);
  }
  mergeStaticMeshes(group);

  /* ---------------- 雷击 / 电弧 ---------------- */
  const STRIKE_SLOTS = 64;
  const ARC_SLOTS = 48;
  const ribbons = new BoltRibbons(STRIKE_SLOTS + ARC_SLOTS * 2, 'canyonLightning');
  group.add(ribbons.mesh);
  const flashCards = createGlowCards(
    [
      { x: 0, y: 0, z: 0, size: 220, color: 0xc8d8ff, flicker: 0 },
      { x: 0, y: 0, z: 0, size: 520, color: 0x9ab0ff, flicker: 0 },
    ],
    'canyonStrikeFlash',
    0
  );
  flashCards.setIntensity(0);
  group.add(flashCards.mesh);
  const flashAttr = flashCards.mesh.geometry.getAttribute(
    'aCard'
  ) as THREE.InstancedBufferAttribute;
  const light = new THREE.PointLight(0xd8e4ff, 0, 2600, 2);
  light.name = 'canyonStrikeLight';
  group.add(light);

  const path = createPath(5);
  const branch = createPath(3);
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const coilBase = coilMaterial.emissiveIntensity;
  let strikeRemaining = 0;
  let strikeDuration = 0.5;
  let strikeSlots = 0;
  let cooldown = 2 + rng() * 3;
  let surge = 0;
  let arcRemaining = 0;
  let arcFrom = -1;
  let arcTo = -1;
  let arcTimer = 0;
  let restrike = 0;

  const writePath = (
    points: THREE.Vector3[],
    firstSlot: number,
    maxSlots: number,
    width: number,
    intensity: number
  ): number => {
    let slot = firstSlot;
    for (let i = 0; i < points.length - 1 && slot < firstSlot + maxSlots; i++) {
      const taper = 1 - (i / points.length) * 0.35;
      ribbons.setSegment(slot++, points[i], points[i + 1], width * taper, intensity);
    }
    return slot;
  };

  const strike = (): void => {
    if (spikeTips.length === 0) return;
    const index = Math.floor(rng() * spikeTips.length);
    const tip = spikeTips[index];
    tmpA.set(tip.x + (rng() - 0.5) * 260, ctx.ceilingY - 10, tip.z + (rng() - 0.5) * 260);
    jaggedPath(tmpA, tip, 0.22, rng, path);
    ribbons.clear(0, STRIKE_SLOTS);
    let slot = writePath(path, 0, 34, 2.2, 1);
    // 两条分叉（起点取主通道上段，向下斜出）
    for (let b = 0; b < 2; b++) {
      const from = path[4 + Math.floor(rng() * (path.length - 12))];
      tmpB.set(
        from.x + (rng() - 0.5) * 160,
        from.y - 60 - rng() * 90,
        from.z + (rng() - 0.5) * 160
      );
      jaggedPath(from, tmpB, 0.3, rng, branch);
      slot = writePath(branch, slot, 14, 1.1, 0.7);
    }
    strikeSlots = slot;
    ribbons.commit();
    strikeDuration = 0.42 + rng() * 0.2;
    strikeRemaining = strikeDuration;
    flashAttr.setXYZ(0, tip.x, tip.y + 6, tip.z);
    flashAttr.setXYZ(1, tmpA.x, tmpA.y - 40, tmpA.z);
    flashAttr.needsUpdate = true;
    light.position.copy(tip).setY(tip.y + 30);
    ctx.flash.uFlashPos.value.copy(tip);
    surge = 1;
    const partner = ctx.sites[index]?.partner ?? -1;
    if (partner >= 0 && partner < coilTips.length) {
      arcFrom = index;
      arcTo = partner;
      arcRemaining = 0.9 + rng() * 0.6;
      arcTimer = 0;
    }
  };

  const writeArc = (): void => {
    if (arcFrom < 0 || arcTo < 0) return;
    const a = coilTips[arcFrom];
    const b = coilTips[arcTo];
    for (let k = 0; k < 2; k++) {
      // 跨谷电弧：中段下垂的弧线 + 锯齿
      jaggedPath(a, b, 0.09, rng, path);
      const sag = a.distanceTo(b) * 0.08 * (k === 0 ? 1 : 0.6);
      for (let i = 0; i < path.length; i++) {
        const t = i / (path.length - 1);
        path[i].y -= Math.sin(t * Math.PI) * sag;
      }
      writePath(
        path,
        STRIKE_SLOTS + k * ARC_SLOTS,
        ARC_SLOTS,
        k === 0 ? 1.5 : 0.8,
        k === 0 ? 0.95 : 0.6
      );
    }
    ribbons.commit();
  };

  const headYaw = { value: 0 };
  const beaconOn = new THREE.Color(0xff2a1a);
  const beaconOff = new THREE.Color(0x3a0806);

  const update = (dt: number, elapsed: number): void => {
    // 线圈常态噼啪 + 雷击后的充能暴涨
    surge = Math.max(0, surge - dt * 0.7);
    coilMaterial.emissiveIntensity =
      coilBase * (0.75 + 0.25 * Math.abs(Math.sin(elapsed * 23.0) * Math.sin(elapsed * 7.3))) +
      surge * 4.5;
    beaconMaterial.color.copy(Math.sin(elapsed * 3.4) > 0.3 ? beaconOn : beaconOff);
    if (mooringBeacon) {
      headYaw.value += dt * 2.2;
      mooringBeacon.rotation.y = headYaw.value;
    }

    if (strikeRemaining > 0) {
      strikeRemaining -= dt;
      const fade = Math.max(0, strikeRemaining / strikeDuration);
      const flicker = fade * (0.5 + 0.5 * Math.abs(Math.sin(elapsed * 57)));
      ribbons.setIntensity(0, strikeSlots, flicker > 0.02 ? 0.35 + flicker : 0);
      ribbons.commit();
      flashCards.setIntensity(flicker * 1.4);
      light.intensity = 38000 * flicker;
      ctx.flash.uFlash.value = flicker;
      if (strikeRemaining <= 0) {
        ribbons.clear(0, STRIKE_SLOTS);
        ribbons.commit();
        flashCards.setIntensity(0);
        light.intensity = 0;
        ctx.flash.uFlash.value = 0;
        // 偶发连击（同一通道复燃）
        if (restrike <= 0 && rng() < 0.35) {
          restrike = 1;
          cooldown = 0.12 + rng() * 0.18;
        } else {
          restrike = 0;
          cooldown = 3.2 + rng() * 6.5;
        }
      }
    } else {
      cooldown -= dt;
      if (cooldown <= 0) {
        strike();
      }
    }

    if (arcRemaining > 0) {
      arcRemaining -= dt;
      arcTimer -= dt;
      if (arcTimer <= 0) {
        arcTimer = 0.05 + rng() * 0.05;
        writeArc();
      }
      if (arcRemaining <= 0) {
        ribbons.clear(STRIKE_SLOTS, STRIKE_SLOTS + ARC_SLOTS * 2);
        ribbons.commit();
      }
    }
    flashCards.update(elapsed);
  };

  return { group, glows, steam, update };
}
