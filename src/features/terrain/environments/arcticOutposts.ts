/**
 * 冰封前哨站：驻扎在冰架与平顶冰山上的神谕雷达站。
 * 测地线雷达罩、旋转雷达天线、预制营房（暖色窗光）、卧式油罐、通信桅杆（红色障碍灯）、
 * 探照灯（加色光锥）与直升机坪。只构建几何与辉光点，动画由返回的 animate 驱动。
 */
import * as THREE from 'three';
import type { SceneDesignTokens } from '../LevelConfig';
import { setInstanceTransform } from './envKit';
import type { GlowCard } from './lavaMaterials';
import type { ArcticField, IceFeature } from './ArcticField';

export interface OutpostBuildResult {
  group: THREE.Group;
  glows: GlowCard[];
  animate(elapsed: number): void;
}

interface OutpostSite {
  x: number;
  z: number;
  y: number;
  /** 朝向战场中心的偏航角 */
  yaw: number;
  large: boolean;
}

/** 前哨站选址：冰架取朝向战场中心一侧、距冰崖约 90 米处；平顶冰山取中心 */
function siteFor(feature: IceFeature, waterY: number): OutpostSite {
  const shape = feature.shape;
  if (feature.kind === 'shelf') {
    const toCenter = Math.atan2(-shape.centerZ, -shape.centerX);
    const r = shape.radiusAt(toCenter) - 90;
    const x = shape.centerX + Math.cos(toCenter) * r;
    const z = shape.centerZ + Math.sin(toCenter) * r;
    return { x, z, y: waterY + feature.top, yaw: -toCenter + Math.PI / 2, large: true };
  }
  return {
    x: shape.centerX,
    z: shape.centerZ,
    y: waterY + feature.top,
    yaw: Math.atan2(-shape.centerX, -shape.centerZ),
    large: false,
  };
}

export function buildArcticOutposts(
  field: ArcticField,
  tokens: SceneDesignTokens,
  waterY: number
): OutpostBuildResult {
  const group = new THREE.Group();
  group.name = 'arcticOutposts';
  const glows: GlowCard[] = [];
  const sites = field.features
    .filter((feature) => feature.outpost)
    .map((feature) => siteFor(feature, waterY));

  const domeMaterial = new THREE.MeshStandardMaterial({
    color: 0xe6edf2,
    roughness: 0.55,
    metalness: 0.05,
    flatShading: true,
  });
  const steel = new THREE.MeshStandardMaterial({
    color: tokens.structure,
    roughness: 0.6,
    metalness: 0.55,
  });
  const hutMaterial = new THREE.MeshStandardMaterial({ color: 0x55606c, roughness: 0.8 });
  const snowRoof = new THREE.MeshStandardMaterial({ color: 0xeef4f8, roughness: 0.9 });
  const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xffc27a });
  const stripeMaterial = new THREE.MeshBasicMaterial({ color: 0xc8241a });
  const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  const padMaterial = new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.9 });
  const padRing = new THREE.MeshBasicMaterial({ color: 0xffc23a });
  const coneMaterial = new THREE.MeshBasicMaterial({
    color: 0xffe2b0,
    transparent: true,
    opacity: 0.09,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: true,
  });

  const domeGeometry = new THREE.IcosahedronGeometry(1, 1);
  const hutGeometry = new THREE.BoxGeometry(14, 6, 9);
  const roofGeometry = new THREE.CylinderGeometry(0.01, 6.4, 3, 4, 1);
  roofGeometry.rotateY(Math.PI / 4);
  roofGeometry.scale(1.55, 1, 1);
  const dishGeometry = new THREE.LatheGeometry(
    Array.from({ length: 7 }, (_, i) => new THREE.Vector2(i * 1.6, (i * 1.6) ** 2 * 0.06)),
    16
  );
  dishGeometry.rotateX(Math.PI / 2);
  const dishes: THREE.Object3D[] = [];
  const beacons: THREE.Vector3[] = [];

  for (const site of sites) {
    const base = new THREE.Group();
    base.position.set(site.x, site.y, site.z);
    base.rotation.y = site.yaw;

    // 测地线雷达罩 + 基座
    const domeSpecs = site.large
      ? [
          { x: 0, z: 0, r: 14 },
          { x: 40, z: 16, r: 10 },
        ]
      : [{ x: 0, z: 0, r: 11 }];
    for (const spec of domeSpecs) {
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(spec.r * 0.9, spec.r, 6, 14), steel);
      plinth.position.set(spec.x, 3, spec.z);
      base.add(plinth);
      const dome = new THREE.Mesh(domeGeometry, domeMaterial);
      dome.scale.setScalar(spec.r);
      dome.position.set(spec.x, 6 + spec.r * 0.55, spec.z);
      dome.castShadow = true;
      base.add(dome);
      const band = new THREE.Mesh(new THREE.TorusGeometry(spec.r * 0.93, 0.5, 4, 24), stripeMaterial);
      band.rotation.x = Math.PI / 2;
      band.position.set(spec.x, 6.4, spec.z);
      base.add(band);
    }

    // 旋转雷达：格构桅杆 + 抛物面天线
    const radarX = site.large ? -34 : 20;
    const mast = new THREE.Mesh(new THREE.BoxGeometry(2.4, 24, 2.4), steel);
    mast.position.set(radarX, 12, -10);
    base.add(mast);
    const dishPivot = new THREE.Group();
    dishPivot.position.set(radarX, 25, -10);
    const dish = new THREE.Mesh(dishGeometry, domeMaterial);
    dish.position.z = 1.5;
    dishPivot.add(dish);
    base.add(dishPivot);
    dishes.push(dishPivot);

    // 营房
    const hutCount = site.large ? 4 : 1;
    for (let h = 0; h < hutCount; h++) {
      const hx = site.large ? -18 + h * 17 : -16;
      const hz = site.large ? 34 : 14;
      const hut = new THREE.Mesh(hutGeometry, hutMaterial);
      hut.position.set(hx, 3, hz);
      base.add(hut);
      const roof = new THREE.Mesh(roofGeometry, snowRoof);
      roof.position.set(hx, 7.5, hz);
      base.add(roof);
      const windowStrip = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 0.3), windowMaterial);
      windowStrip.position.set(hx, 3.6, hz + 4.6);
      base.add(windowStrip);
    }

    // 卧式油罐
    if (site.large) {
      for (let t = 0; t < 2; t++) {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 18, 12), steel);
        tank.rotation.z = Math.PI / 2;
        tank.position.set(-44 + t * 9, 3.4, 42);
        base.add(tank);
      }
      // 直升机坪
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 0.8, 24), padMaterial);
      pad.position.set(48, 0.4, -30);
      base.add(pad);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(12.5, 0.45, 4, 32), padRing);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(48, 0.9, -30);
      base.add(ring);
    }

    // 通信桅杆
    const antennaHeight = site.large ? 46 : 30;
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, antennaHeight, 6), steel);
    antenna.position.set(site.large ? 20 : -4, antennaHeight / 2, site.large ? -20 : -14);
    base.add(antenna);

    // 探照灯：灯杆 + 向下的光锥
    const lampSpots = site.large
      ? [
          [-50, 10],
          [52, 30],
          [0, -44],
        ]
      : [[18, 16]];
    base.updateMatrixWorld(true);
    for (const [lx, lz] of lampSpots) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 14, 6), steel);
      pole.position.set(lx, 7, lz);
      base.add(pole);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(9, 14, 16, 1, true), coneMaterial);
      cone.position.set(lx, 7, lz);
      cone.renderOrder = 0;
      base.add(cone);
      const lampWorld = new THREE.Vector3(lx, 14.5, lz).applyMatrix4(base.matrixWorld);
      glows.push({ x: lampWorld.x, y: lampWorld.y, z: lampWorld.z, size: 14, color: 0xffd9a0, flicker: 0 });
    }

    group.add(base);
    base.updateMatrixWorld(true);
    beacons.push(
      new THREE.Vector3(site.large ? 20 : -4, antennaHeight + 0.8, site.large ? -20 : -14).applyMatrix4(
        base.matrixWorld
      ),
      new THREE.Vector3(site.large ? 20 : -4, antennaHeight * 0.55, site.large ? -20 : -14).applyMatrix4(
        base.matrixWorld
      ),
      new THREE.Vector3(0, 6 + (site.large ? 14 : 11) * 1.5, 0).applyMatrix4(base.matrixWorld)
    );
  }

  const beaconMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1.1, 8, 6),
    beaconMaterial,
    Math.max(1, beacons.length)
  );
  beaconMesh.name = 'outpostBeacons';
  beacons.forEach((beacon, i) => {
    setInstanceTransform(beaconMesh, i, beacon.x, beacon.y, beacon.z, 0, 1);
    glows.push({ x: beacon.x, y: beacon.y, z: beacon.z, size: 10, color: 0xff3a2a, flicker: 0 });
  });
  beaconMesh.count = beacons.length;
  beaconMesh.instanceMatrix.needsUpdate = true;
  group.add(beaconMesh);

  const beaconOn = new THREE.Color(0xff2a1a);
  const beaconOff = new THREE.Color(0x2a0604);
  return {
    group,
    glows,
    animate(elapsed: number) {
      for (let i = 0; i < dishes.length; i++) {
        dishes[i].rotation.y = elapsed * (0.9 + i * 0.13) + i;
      }
      beaconMaterial.color.copy(Math.sin(elapsed * 2.6) > 0.3 ? beaconOn : beaconOff);
    },
  };
}
