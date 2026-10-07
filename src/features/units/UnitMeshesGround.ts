import * as THREE from 'three';
import {
  NodeBuilder,
  addHostileMark,
  addRoundel,
  box,
  coneZ,
  cyl,
  cylX,
  cylZ,
  invertFaces,
  sphere,
  torus,
  type PaletteKey,
} from './UnitMeshKit';

/**
 * 地面单位模型：主战坦克、地空导弹车、双联高炮、雷达站、友军车队卡车、民用卡车。
 * 原点位于地面接触点，前方 +Z。
 */

function addWheelSet(
  node: NodeBuilder,
  axlesZ: readonly number[],
  halfTrack: number,
  radius: number,
  width: number,
  y = radius
): void {
  for (const z of axlesZ) {
    for (const side of [1, -1]) {
      node.add('rubber', cylX(radius, width, 14), [side * halfTrack, y, z]);
      node.add('metal', cylX(radius * 0.48, width + 0.06, 10), [side * halfTrack, y, z]);
    }
  }
}

/** 主战坦克：倾斜首上装甲、六角炮塔、长身管火炮（炮塔 / 炮管可动） */
export function buildTank(): NodeBuilder {
  const root = new NodeBuilder('TANK');
  // 履带与负重轮
  for (const side of [1, -1]) {
    root.add('rubber', box(0.95, 1.1, 7.4), [side * 1.6, 0.55, 0]);
    root.add('hOlive', box(1.2, 0.14, 7.7), [side * 1.62, 1.22, 0.05]);
    for (let i = 0; i < 6; i++) {
      root.add('metal', cylX(0.4, 0.2, 12), [side * 2.12, 0.5, -2.75 + i * 1.1]);
    }
    root.add('metal', cylX(0.34, 0.2, 10), [side * 2.12, 0.75, 3.45]);
    root.add('metal', cylX(0.34, 0.2, 10), [side * 2.12, 0.75, -3.45]);
    // 侧裙板红色识别带
    root.add('hRed', box(0.06, 0.18, 5.2), [side * 2.24, 1.05, 0.2]);
  }
  // 车体
  root.add('hOlive', box(2.3, 0.9, 7.0), [0, 0.95, -0.1]);
  root.add('hOlive', box(3.3, 0.55, 5.7), [0, 1.62, -0.6]);
  root.add('hOlive', box(3.3, 0.5, 1.9), [0, 1.42, 2.95], [0.42, 0, 0]);
  root.add('hDark', box(2.6, 0.12, 1.7), [0, 1.93, -2.55]);
  for (let i = 0; i < 4; i++) {
    root.add('hDark', box(2.4, 0.06, 0.12), [0, 2.0, -3.2 + i * 0.42]);
  }
  root.add('metal', cylZ(0.16, 0.16, 0.5, 8), [0.95, 1.55, -3.75]);
  root.add('metal', cylZ(0.16, 0.16, 0.5, 8), [-0.95, 1.55, -3.75]);
  // 前灯与驾驶员潜望镜
  root.add('hGlow', box(0.22, 0.14, 0.06), [1.25, 1.55, 3.82]);
  root.add('hGlow', box(0.22, 0.14, 0.06), [-1.25, 1.55, 3.82]);
  root.add('hDark', box(0.5, 0.2, 0.3), [0.7, 1.95, 2.3]);

  // 炮塔（可偏航）
  const turret = root.child('turret', [0, 1.9, -0.35]);
  turret.add('hOlive', cyl(1.75, 1.95, 0.85, 6), [0, 0.42, 0], [0, Math.PI / 6, 0], [1, 1, 1.18]);
  turret.add('hOlive', box(2.2, 0.62, 1.2), [0, 0.38, 1.85], [0.28, 0, 0]);
  turret.add('hDark', box(2.6, 0.6, 1.0), [0, 0.42, -2.05]);
  turret.add('metal', box(2.7, 0.08, 1.1), [0, 0.75, -2.05]);
  turret.add('hDark', cyl(0.4, 0.42, 0.38, 10), [0.7, 1.02, -0.45]);
  turret.add('metal', cyl(0.44, 0.44, 0.08, 10), [0.7, 1.24, -0.45]);
  turret.add('hDark', box(0.5, 0.42, 0.55), [-0.75, 1.02, 0.55]);
  turret.add('hGlow', box(0.32, 0.18, 0.06), [-0.75, 1.04, 0.84]);
  turret.add('metal', cyl(0.025, 0.035, 2.4, 5), [-0.95, 2.0, -1.85]);
  addHostileMark(turret, [1.62, 0.42, -0.2], 0.42, 'port');
  addHostileMark(turret, [-1.62, 0.42, -0.2], 0.42, 'starboard');
  addHostileMark(turret, [0, 0.86, -0.75], 0.5, 'up');

  // 火炮（可俯仰）
  const barrel = turret.child('barrel', [0, 0.45, 1.75]);
  barrel.add('hOlive', box(0.7, 0.55, 0.7), [0, 0, 0.15]);
  barrel.add('metal', cylZ(0.15, 0.17, 5.3, 10), [0, 0, 2.85]);
  barrel.add('hDark', cylZ(0.23, 0.23, 0.75, 10), [0, 0, 2.2]);
  barrel.add('hDark', cylZ(0.21, 0.21, 0.45, 10), [0, 0, 5.4]);
  barrel.child('muzzle', [0, 0, 5.8]);
  return root;
}

/** 地空导弹车：八轮底盘 + 可旋转发射塔 + 四联导弹导轨（可俯仰，逐枚可隐藏） */
export function buildSamLauncher(): NodeBuilder {
  const root = new NodeBuilder('SAM_LAUNCHER');
  root.add('hDark', box(2.5, 0.55, 9.6), [0, 1.25, -0.2]);
  addWheelSet(root, [3.4, 2.0, -1.8, -3.2], 1.32, 0.62, 0.5);
  for (const side of [1, -1]) {
    root.add('hOlive', box(0.5, 0.12, 9.0), [side * 1.32, 1.55, -0.2]);
  }
  // 驾驶室
  root.add('hOlive', box(2.7, 1.55, 2.2), [0, 2.3, 3.95]);
  root.add('glass', box(2.4, 0.62, 0.08), [0, 2.65, 5.07], [-0.22, 0, 0]);
  root.add('hRed', box(2.74, 0.16, 2.24), [0, 1.65, 3.95]);
  root.add('hGlow', box(0.3, 0.16, 0.06), [0.95, 1.9, 5.07]);
  root.add('hGlow', box(0.3, 0.16, 0.06), [-0.95, 1.9, 5.07]);
  // 后部平台
  root.add('hHull', box(2.6, 0.32, 6.4), [0, 1.66, -0.95]);
  root.add('hDark', box(2.2, 0.9, 1.4), [0, 2.25, 2.1]);
  root.add('metal', cyl(0.05, 0.05, 1.6, 5), [1.0, 3.4, 2.4]);

  // 发射塔（偏航）
  const turret = root.child('turret', [0, 1.85, -1.4]);
  turret.add('hHull', cyl(1.45, 1.6, 0.5, 14), [0, 0.25, 0]);
  turret.add('hDark', box(1.4, 1.2, 1.3), [0, 1.05, 1.05]);
  turret.add('hGlow', cyl(0.28, 0.28, 0.06, 10), [0, 1.15, 1.72], [Math.PI / 2, 0, 0]);
  turret.add('hRed', box(1.44, 0.14, 1.34), [0, 1.62, 1.05]);
  addHostileMark(turret, [0, 1.68, 1.05], 0.45, 'up');

  // 发射架（俯仰：rotation.x 取负值抬起）
  const launcher = turret.child('launcher', [0, 0.85, -0.6]);
  launcher.add('hDark', box(3.0, 0.22, 4.6), [0, 0, 1.4]);
  launcher.add('metal', box(0.24, 0.5, 0.5), [1.3, -0.2, 0]);
  launcher.add('metal', box(0.24, 0.5, 0.5), [-1.3, -0.2, 0]);
  const railX = [-1.05, -0.35, 0.35, 1.05];
  for (const x of railX) {
    launcher.add('metal', box(0.14, 0.12, 4.4), [x, 0.17, 1.4]);
    const missile = launcher.child('rackMissiles', [x, 0.48, 1.4], [0, 0, 0], true);
    missile.add('fWhite', cylZ(0.19, 0.19, 3.6, 10), [0, 0, 0]);
    missile.add('fWhite', coneZ(0.19, 0.9, 10), [0, 0, 2.25]);
    missile.add('hRed', cylZ(0.2, 0.2, 0.3, 10), [0, 0, 1.4]);
    missile.add('hDark', box(0.05, 0.62, 0.55), [0, 0, -1.45]);
    missile.add('hDark', box(0.62, 0.05, 0.55), [0, 0, -1.45]);
    missile.add('hDark', box(0.04, 0.42, 0.4), [0, 0, 0.5]);
  }
  launcher.child('muzzle', [0, 0.5, 3.8]);
  return root;
}

/** 双联高炮：沙袋掩体 + 旋转炮座 + 双管俯仰炮身 */
export function buildAaGun(): NodeBuilder {
  const root = new NodeBuilder('AA_GUN');
  root.add('hSand', torus(4.3, 0.62, 20), [0, 0.42, 0], [Math.PI / 2, 0, 0]);
  root.add('hSand', torus(4.3, 0.5, 20), [0, 1.05, 0], [Math.PI / 2, 0, 0.3]);
  root.add('hDark', cyl(3.6, 3.7, 0.35, 20), [0, 0.18, 0]);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    root.add('hDark', box(0.5, 0.3, 3.0), [Math.sin(a) * 1.6, 0.42, Math.cos(a) * 1.6], [0, a, 0]);
  }
  // 弹药箱
  root.add('hOlive', box(1.0, 0.6, 0.7), [2.6, 0.62, -1.6]);
  root.add('hOlive', box(1.0, 0.6, 0.7), [2.4, 0.62, -0.7]);
  root.add('hRed', box(1.02, 0.1, 0.72), [2.6, 0.9, -1.6]);

  const turret = root.child('turret', [0, 0.6, 0]);
  turret.add('hOlive', cyl(1.5, 1.65, 0.6, 16), [0, 0.3, 0]);
  turret.add('hHull', box(2.3, 1.3, 2.2), [0, 1.2, -0.2]);
  turret.add('hOlive', box(0.18, 1.2, 1.8), [1.25, 1.35, 0.2], [0, 0.18, 0]);
  turret.add('hOlive', box(0.18, 1.2, 1.8), [-1.25, 1.35, 0.2], [0, -0.18, 0]);
  turret.add('hDark', box(0.55, 0.55, 0.8), [0.85, 2.05, -0.6]);
  turret.add('hGlow', box(0.3, 0.2, 0.05), [0.85, 2.1, -0.18]);
  turret.add('hRed', box(2.32, 0.14, 2.22), [0, 1.9, -0.2]);
  addHostileMark(turret, [0, 1.88, -0.4], 0.5, 'up');

  const barrel = turret.child('barrel', [0, 1.45, 0.5]);
  barrel.add('hHull', box(1.7, 0.6, 1.3), [0, 0, 0.2]);
  for (const x of [0.55, -0.55]) {
    barrel.add('metal', cylZ(0.11, 0.13, 4.3, 8), [x, 0.05, 2.9]);
    barrel.add('hDark', cylZ(0.17, 0.17, 0.55, 8), [x, 0.05, 5.05]);
    barrel.add('hDark', cylZ(0.18, 0.18, 0.9, 8), [x, 0.05, 1.3]);
    barrel.child('muzzles', [x, 0.05, 5.4], [0, 0, 0], true);
  }
  barrel.add('hDark', box(0.5, 0.7, 0.9), [1.1, -0.15, 0.2]);
  barrel.add('hDark', box(0.5, 0.7, 0.9), [-1.1, -0.15, 0.2]);
  return root;
}

/** 雷达站：营房 + 格构塔 + 旋转抛物面天线（dish）+ 闪烁信标 */
export function buildRadarStation(): NodeBuilder {
  const root = new NodeBuilder('RADAR_STATION');
  root.add('hHull', box(6.2, 3.0, 6.2), [0, 1.5, 0]);
  root.add('hDark', box(6.6, 0.3, 6.6), [0, 3.15, 0]);
  root.add('hDark', box(1.4, 2.0, 0.1), [0, 1.0, 3.12]);
  for (const side of [1, -1]) {
    root.add('hRed', box(6.24, 0.22, 0.06), [0, 2.6, side * 3.11]);
    root.add('hRed', box(0.06, 0.22, 6.24), [side * 3.11, 2.6, 0]);
  }
  for (let i = 0; i < 3; i++) {
    root.add('hGlow', box(0.9, 0.35, 0.06), [-2.0 + i * 2.0, 2.05, -3.12]);
  }
  // 发电机与天线杆
  root.add('hOlive', box(2.4, 1.4, 1.6), [4.4, 0.7, -1.8]);
  root.add('metal', cyl(0.15, 0.15, 1.2, 8), [4.9, 1.9, -2.2]);
  root.add('fWhite', sphere(1.1, 14, 8), [-2.2, 3.6, -2.2], [0, 0, 0], [1, 0.8, 1]);
  root.add('metal', cyl(0.05, 0.05, 4.5, 5), [2.6, 5.4, 2.6]);
  // 格构塔
  const towerBottom = 3.3;
  const towerTop = 11.2;
  const height = towerTop - towerBottom;
  const legSpread = 2.1;
  const topSpread = 0.75;
  const legTilt = Math.atan2(legSpread - topSpread, height);
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const mx = (sx * (legSpread + topSpread)) / 2;
      const mz = (sz * (legSpread + topSpread)) / 2;
      root.add(
        'metal',
        cyl(0.11, 0.14, height + 0.4, 6),
        [mx, towerBottom + height / 2, mz],
        [-sz * legTilt, 0, sx * legTilt]
      );
    }
  }
  for (let level = 0; level < 3; level++) {
    const y = towerBottom + 1.6 + level * 2.4;
    const t = (y - towerBottom) / height;
    const spread = legSpread + (topSpread - legSpread) * t;
    for (const side of [1, -1]) {
      root.add('metal', box(spread * 2, 0.12, 0.12), [0, y, side * spread]);
      root.add('metal', box(0.12, 0.12, spread * 2), [side * spread, y, 0]);
    }
  }
  root.add('hDark', cyl(1.5, 1.5, 0.4, 14), [0, towerTop, 0]);
  root.add('beacon', sphere(0.32, 8, 6), [1.25, towerTop + 0.45, 1.25]);
  root.add('beacon', sphere(0.32, 8, 6), [-1.25, towerTop + 0.45, -1.25]);

  // 旋转天线（绕 Y 轴）
  const dish = root.child('dish', [0, towerTop + 0.4, 0]);
  dish.add('metal', cyl(0.35, 0.45, 1.2, 10), [0, 0.6, 0]);
  // 浅抛物面：球冠顶点平移到原点，开口朝前上方 20°
  const reflector = new THREE.SphereGeometry(4.2, 18, 6, 0, Math.PI * 2, 0, 0.62);
  reflector.scale(1, 0.55, 1);
  reflector.translate(0, -4.2 * 0.55, 0);
  const reflectorInner = invertFaces(reflector.clone());
  dish.add('hHull', reflector, [0, 2.9, -0.2], [-Math.PI / 2 - 0.35, 0, 0]);
  // 翻转绕序的副本 → 凹面（反射面）同样可见
  dish.add('fGrey', reflectorInner, [0, 2.9, -0.2], [-Math.PI / 2 - 0.35, 0, 0]);
  dish.add('hRed', torus(2.45, 0.12, 20), [0, 3.05, 0.2], [-0.35, 0, 0]);
  dish.add('metal', cylZ(0.08, 0.08, 3.4, 6), [0, 3.48, 1.4], [-0.35, 0, 0]);
  dish.add('hGlow', sphere(0.28, 8, 6), [0, 4.06, 3.0]);
  dish.add('hDark', box(1.2, 1.0, 1.2), [0, 2.3, -1.0]);
  return root;
}

function buildTruckBase(
  name: string,
  cabKey: PaletteKey,
  bodyKey: PaletteKey,
  chassisKey: PaletteKey
): NodeBuilder {
  const root = new NodeBuilder(name);
  root.add(chassisKey, box(2.3, 0.45, 8.4), [0, 1.0, -0.1]);
  addWheelSet(root, [2.9, -1.7, -3.0], 1.18, 0.55, 0.42);
  root.add(cabKey, box(2.5, 1.7, 2.0), [0, 2.0, 3.0]);
  root.add(cabKey, box(2.5, 0.5, 0.8), [0, 1.3, 4.1]);
  root.add('glass', box(2.2, 0.75, 0.08), [0, 2.35, 4.02], [-0.18, 0, 0]);
  root.add('glass', box(0.08, 0.55, 1.1), [1.26, 2.35, 3.2]);
  root.add('glass', box(0.08, 0.55, 1.1), [-1.26, 2.35, 3.2]);
  root.add('navWhite', box(0.36, 0.2, 0.06), [0.85, 1.35, 4.52]);
  root.add('navWhite', box(0.36, 0.2, 0.06), [-0.85, 1.35, 4.52]);
  root.add('navRed', box(0.3, 0.18, 0.06), [0.95, 1.2, -4.33]);
  root.add('navRed', box(0.3, 0.18, 0.06), [-0.95, 1.2, -4.33]);
  root.add(bodyKey, box(2.55, 2.4, 5.6), [0, 2.45, -1.45]);
  return root;
}

/** 友军车队卡车：蓝色驾驶室 + 白色货厢（侧面 / 顶部圆形徽标，空中易辨识） */
export function buildAllyConvoy(): NodeBuilder {
  const root = buildTruckBase('ALLY_CONVOY', 'fBlue', 'fWhite', 'fNavy');
  root.add('fBlue', box(2.6, 0.32, 5.64), [0, 1.4, -1.45]);
  root.add('fBlue', box(2.6, 0.12, 5.64), [0, 3.67, -1.45]);
  addRoundel(root, [0, 3.66, -1.45], 1.05, 'up');
  addRoundel(root, [1.28, 2.55, -1.45], 0.8, 'port');
  addRoundel(root, [-1.28, 2.55, -1.45], 0.8, 'starboard');
  root.add('fGold', box(0.5, 0.18, 0.3), [0, 2.95, 3.0]);
  root.add('metal', cyl(0.04, 0.04, 1.8, 5), [-0.9, 3.7, 2.6]);
  root.add('fNavy', box(2.55, 0.5, 0.25), [0, 1.0, 4.45]);
  return root;
}

/** 民用卡车：橙色驾驶室 + 白色厢体（青 / 橙涂装条） */
export function buildCivilianTruck(): NodeBuilder {
  const root = buildTruckBase('CIVILIAN_TRUCK', 'cOrange', 'cWhite', 'cHullBlack');
  for (const side of [1, -1]) {
    root.add('cTeal', box(0.06, 0.42, 5.4), [side * 1.29, 2.2, -1.45]);
    root.add('cOrange', box(0.06, 0.16, 5.4), [side * 1.29, 1.85, -1.45]);
  }
  root.add('cTeal', box(1.0, 0.06, 5.0), [0, 3.66, -1.45]);
  root.add('cOrange', box(1.6, 0.06, 0.5), [0, 3.66, 0.6]);
  root.add('cOrange', box(2.0, 0.1, 0.3), [0, 2.9, 3.6]);
  root.add('navGreen', box(0.12, 0.12, 0.12), [-1.2, 2.88, 3.95]);
  root.add('navRed', box(0.12, 0.12, 0.12), [1.2, 2.88, 3.95]);
  return root;
}
