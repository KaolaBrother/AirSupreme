import {
  NodeBuilder,
  addHostileMark,
  addRoundel,
  box,
  coneZ,
  cyl,
  cylZ,
  fin,
  fuselage,
  sphere,
  wing,
  type PaletteKey,
} from './UnitMeshKit';

/**
 * 空中单位模型：武装直升机、战略轰炸机、自杀无人机、友军预警机、友军运输机、民航客机。
 * 原点位于机体中心，机头 +Z。旋翼 / 螺旋桨 / 雷达罩为可动子节点。
 */

function addProp(
  node: NodeBuilder,
  position: readonly [number, number, number],
  bladeLength: number,
  blades: number,
  hubKey: PaletteKey
): void {
  const prop = node.child('props', position, [0, 0, 0], true);
  prop.add(hubKey, coneZ(0.42, 1.1, 10), [0, 0, 0.35]);
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2;
    prop.add(
      'hDark',
      box(0.32, bladeLength, 0.08),
      [Math.sin(a) * bladeLength * 0.5, Math.cos(a) * bladeLength * 0.5, 0],
      [0, 0.25, -a]
    );
  }
  prop.add(
    'rotorBlur',
    cyl(bladeLength, bladeLength, 0.03, 24),
    [0, 0, -0.05],
    [Math.PI / 2, 0, 0]
  );
}

/** 武装直升机：窄机身 + 串列座舱 + 短翼火箭巢 + 主 / 尾旋翼 */
export function buildAttackHelicopter(): NodeBuilder {
  const root = new NodeBuilder('ATTACK_HELICOPTER');
  root.add(
    'hHull',
    fuselage(
      [
        [-8.6, 0.26],
        [-6.2, 0.4],
        [-3.2, 0.72],
        [-1.2, 1.12],
        [1.4, 1.22],
        [3.4, 1.02],
        [4.9, 0.62],
        [5.5, 0.12],
      ],
      14
    ),
    [0, 0, 0],
    [0, 0, 0],
    [0.78, 1, 1]
  );
  // 串列座舱
  root.add('glass', box(1.0, 0.75, 1.8), [0, 0.95, 2.7], [0.32, 0, 0]);
  root.add('glass', box(1.05, 0.85, 1.7), [0, 1.3, 1.1], [0.22, 0, 0]);
  root.add('hDark', box(0.12, 0.9, 3.6), [0, 1.25, 1.9]);
  // 发动机舱
  for (const side of [1, -1]) {
    root.add('hDark', cylZ(0.44, 0.5, 2.6, 10), [side * 0.85, 0.85, -0.9]);
    root.add('metal', cylZ(0.3, 0.3, 0.3, 10), [side * 0.85, 0.85, -2.25]);
  }
  root.add('hHull', box(1.4, 0.7, 2.2), [0, 1.35, -0.4]);
  // 短翼 + 挂载
  root.add('hHull', box(5.2, 0.18, 1.3), [0, -0.1, 0.2], [0, 0, 0]);
  for (const side of [1, -1]) {
    root.add('hDark', cylZ(0.34, 0.34, 1.9, 10), [side * 2.0, -0.6, 0.3]);
    root.add('hRed', cylZ(0.35, 0.35, 0.25, 10), [side * 2.0, -0.6, 1.2]);
    root.add('hDark', cylZ(0.13, 0.13, 1.6, 8), [side * 2.55, -0.45, 0.4]);
    root.add('hDark', cylZ(0.13, 0.13, 1.6, 8), [side * 2.55, -0.75, 0.4]);
    root.child('muzzles', [side * 2.0, -0.6, 1.4], [0, 0, 0], true);
    // 起落架
    root.add('rubber', cyl(0.28, 0.28, 0.2, 10), [side * 1.1, -1.55, 2.1], [0, 0, Math.PI / 2]);
    root.add('metal', box(0.08, 0.7, 0.08), [side * 1.0, -1.2, 2.1]);
  }
  // 机鼻传感器 + 机炮
  root.add('hDark', sphere(0.42, 10, 8), [0, -0.35, 4.6]);
  root.add('hGlow', sphere(0.2, 8, 6), [0, -0.35, 5.0]);
  root.add('metal', cylZ(0.07, 0.07, 1.4, 6), [0, -0.95, 3.6]);
  root.child('chinGun', [0, -0.95, 4.4]);
  // 尾部
  root.add('hHull', fin(2.4, 2.0, 1.0, 1.0, 0.18), [0, 0.2, -6.8]);
  root.add('hRed', fin(0.6, 1.1, 0.95, 0.15, 0.2), [0, 2.0, -7.85]);
  root.add('hHull', box(3.0, 0.12, 0.9), [0, 0.1, -7.2]);
  root.add('hRed', box(0.28, 0.5, 3.6), [0, 0.42, -4.6], [0, 0, 0], [1, 1, 1]);
  addHostileMark(root, [0, 1.71, -0.4], 0.5, 'up');
  root.add('beacon', sphere(0.14, 6, 4), [0, -1.1, -1.0]);
  // 主旋翼
  const main = root.child('mainRotor', [0, 1.95, 0.2]);
  main.add('metal', cyl(0.32, 0.38, 0.55, 10), [0, -0.1, 0]);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    main.add(
      'hDark',
      box(0.48, 0.07, 7.4),
      [Math.sin(a) * 3.8, 0.12, Math.cos(a) * 3.8],
      [0, a, 0]
    );
    main.add('hRed', box(0.5, 0.075, 0.5), [Math.sin(a) * 7.3, 0.12, Math.cos(a) * 7.3], [0, a, 0]);
  }
  main.add('rotorBlur', cyl(7.6, 7.6, 0.03, 32), [0, 0.12, 0]);
  // 尾旋翼（绕 X 轴旋转）
  const tail = root.child('tailRotor', [0.32, 1.05, -8.15]);
  tail.add('metal', cyl(0.12, 0.12, 0.2, 8), [0, 0, 0], [0, 0, Math.PI / 2]);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    tail.add(
      'hDark',
      box(0.05, 1.25, 0.22),
      [0.06, Math.cos(a) * 0.62, Math.sin(a) * 0.62],
      [a, 0, 0]
    );
  }
  tail.add('rotorBlur', cyl(1.25, 1.25, 0.02, 20), [0.06, 0, 0], [0, 0, Math.PI / 2]);
  return root;
}

/** 战略轰炸机：后掠翼 + 四台对转涡桨（props）+ 尾炮塔（tailGun） */
export function buildBomber(): NodeBuilder {
  const root = new NodeBuilder('BOMBER');
  root.add(
    'hHull',
    fuselage(
      [
        [-20.5, 0.4],
        [-17, 1.4],
        [-10, 2.05],
        [6, 2.15],
        [13, 1.95],
        [17, 1.4],
        [19.3, 0.6],
        [20, 0.1],
      ],
      16
    )
  );
  // 机翼（后掠 + 轻微下反）
  root.add('hHull', wing(21, 8.5, 3.0, 8.5, 0.55, -0.025), [0, -0.1, 5]);
  root.add('hDark', wing(21.02, 1.2, 0.6, 8.55, 0.58, -0.025), [0, -0.1, 5.02]);
  for (const side of [1, -1]) {
    root.add('hRed', box(1.0, 0.6, 2.6), [side * 20.6, -0.6, -4.9]);
    root.add('hGlow', sphere(0.28, 8, 6), [side * 21.0, -0.6, -3.5]);
  }
  addHostileMark(root, [11, 0.2, -2.0], 2.1, 'up');
  addHostileMark(root, [-11, 0.2, -2.0], 2.1, 'up');
  addHostileMark(root, [2.12, 0.4, -9.5], 1.0, 'port');
  addHostileMark(root, [-2.12, 0.4, -9.5], 1.0, 'starboard');
  // 发动机舱 + 对转螺旋桨
  const engines: Array<[number, number]> = [
    [6.5, 2.4],
    [13.2, -0.3],
  ];
  for (const [x, zFront] of engines) {
    for (const side of [1, -1]) {
      root.add('hDark', cylZ(0.75, 0.95, 6.2, 12), [side * x, -0.55, zFront - 2.8]);
      root.add('metal', cylZ(0.55, 0.55, 0.4, 10), [side * x, -0.55, zFront - 6.0]);
      addProp(root, [side * x, -0.55, zFront + 0.6], 2.6, 4, 'metal');
    }
  }
  // 尾翼
  root.add('hHull', fin(8.2, 7.0, 2.8, 5.0, 0.4), [0, 1.2, -12.5]);
  root.add('hRed', fin(1.1, 2.95, 2.8, 0.3, 0.42), [0, 8.7, -17.4]);
  root.add('hHull', wing(8, 5.0, 2.0, 4.0, 0.36, 0), [0, 1.1, -14.2]);
  // 座舱与导航员玻璃机鼻
  root.add('glass', box(2.2, 0.8, 2.6), [0, 1.65, 15.2], [0.25, 0, 0]);
  root.add('glass', sphere(0.9, 12, 8), [0, -0.1, 19.0], [0, 0, 0], [1, 0.9, 1.2]);
  root.add('metal', cylZ(0.08, 0.08, 3.4, 6), [0, 0.2, 21.2]);
  // 弹舱门
  root.add('hDark', box(2.2, 0.1, 9), [0, -2.05, -1]);
  root.add('hRed', box(0.18, 0.12, 9.02), [0, -2.08, -1]);
  // 尾炮塔
  const tailGun = root.child('tailGun', [0, 0.3, -20.3]);
  tailGun.add('glass', sphere(0.75, 10, 8), [0, 0, 0]);
  tailGun.add('metal', cylZ(0.08, 0.08, 1.8, 6), [0.25, 0, -1.1]);
  tailGun.add('metal', cylZ(0.08, 0.08, 1.8, 6), [-0.25, 0, -1.1]);
  tailGun.child('muzzle', [0, 0, -2.1]);
  root.add('beacon', sphere(0.3, 8, 6), [0, 2.2, 2]);
  root.child('bombBay', [0, -2.2, -1]);
  return root;
}

/** 自杀无人机：三角翼 + 翼尖立尾 + 尾推螺旋桨，红色传感器之眼 */
export function buildDrone(): NodeBuilder {
  const root = new NodeBuilder('DRONE');
  root.add(
    'hDark',
    fuselage(
      [
        [-1.9, 0.12],
        [-1.5, 0.27],
        [0.2, 0.32],
        [1.3, 0.26],
        [1.9, 0.08],
      ],
      10
    )
  );
  root.add('hHull', wing(2.4, 3.1, 0.55, 2.55, 0.12, 0), [0, 0, 1.3]);
  for (const side of [1, -1]) {
    root.add('hRed', fin(0.75, 0.6, 0.35, 0.25, 0.06), [side * 2.38, 0.05, -1.25]);
  }
  root.add('hRed', cylZ(0.33, 0.33, 0.2, 10), [0, 0, 1.0]);
  root.add('hGlow', sphere(0.15, 8, 6), [0, 0.05, 1.92]);
  root.add('hRed', box(1.6, 0.03, 0.25), [0, 0.07, -0.2]);
  addProp(root, [0, 0, -2.05], 0.85, 2, 'metal');
  return root;
}

function addAirlinerFrame(
  root: NodeBuilder,
  bodyKey: PaletteKey,
  length: number,
  radius: number
): void {
  const half = length / 2;
  root.add(
    bodyKey,
    fuselage(
      [
        [-half, 0.35],
        [-half + 3.5, radius * 0.7],
        [-half + 8, radius],
        [half - 7, radius],
        [half - 3.2, radius * 0.86],
        [half - 1.0, radius * 0.48],
        [half, 0.12],
      ],
      18
    )
  );
}

/** 友军预警机「天眼」：白色机身 + 蓝色腹带 + 旋转雷达罩（rotodome） */
export function buildAllyAwacs(): NodeBuilder {
  const root = new NodeBuilder('ALLY_AWACS');
  addAirlinerFrame(root, 'fWhite', 40, 2.1);
  for (const side of [1, -1]) {
    root.add('fBlue', box(0.06, 0.5, 30), [side * 2.06, -0.55, 1]);
  }
  root.add('fBlue', box(2.4, 0.06, 26), [0, -2.06, 0]);
  root.add('glass', box(2.2, 0.6, 0.9), [0, 0.95, 17.2], [0.45, 0, 0]);
  root.add('fWhite', wing(19, 7.2, 2.4, 7.0, 0.45, 0.07), [0, -0.8, 4]);
  for (const side of [1, -1]) {
    for (const x of [6.5, 11.5]) {
      const z = 3.4 - (x / 19) * 7.0;
      root.add('fGrey', cylZ(0.72, 0.78, 4.0, 12), [side * x, -1.9 + x * 0.07, z]);
      root.add('fNavy', cylZ(0.62, 0.62, 0.1, 12), [side * x, -1.9 + x * 0.07, z + 2.02]);
    }
    addRoundel(root, [side * 13.5, -0.8 + 13.5 * 0.07 + 0.25, -3.6], 1.2, 'up');
  }
  root.add('navRed', sphere(0.25, 6, 4), [19.1, -0.8 + 19 * 0.07, -3.2]);
  root.add('navGreen', sphere(0.25, 6, 4), [-19.1, -0.8 + 19 * 0.07, -3.2]);
  addRoundel(root, [2.1, 0.3, -9], 0.9, 'port');
  addRoundel(root, [-2.1, 0.3, -9], 0.9, 'starboard');
  // 尾翼
  root.add('fBlue', fin(7.0, 6.2, 2.6, 4.6, 0.36), [0, 1.0, -13.4]);
  root.add('fGold', fin(0.5, 2.7, 2.6, 0.2, 0.38), [0, 6.2, -18.3]);
  root.add('fWhite', wing(7.2, 4.4, 1.8, 3.6, 0.3, 0.05), [0, 0.6, -14.6]);
  // 雷达罩支架（静态）+ 旋转罩
  root.add('fGrey', box(0.4, 2.3, 1.6), [1.2, 2.9, -3.8], [0, 0, -0.25]);
  root.add('fGrey', box(0.4, 2.3, 1.6), [-1.2, 2.9, -3.8], [0, 0, 0.25]);
  const dome = root.child('rotodome', [0, 4.55, -3.8]);
  dome.add('fWhite', cyl(5.3, 5.3, 0.9, 32), [0, 0, 0]);
  dome.add('fBlue', cyl(5.36, 5.36, 0.3, 32), [0, 0, 0]);
  dome.add('fWhite', sphere(5.3, 24, 6), [0, 0.45, 0], [0, 0, 0], [1, 0.09, 1]);
  dome.add('fWhite', sphere(5.3, 24, 6), [0, -0.45, 0], [0, 0, 0], [1, 0.09, 1]);
  addRoundel(dome, [2.8, 0.95, 0], 1.0, 'up');
  root.add('beacon', sphere(0.28, 8, 6), [0, -2.2, 6]);
  return root;
}

/** 友军运输机：上单翼 + 四台涡桨（props）+ T 型尾翼，蓝色垂尾与圆形徽标 */
export function buildAllyTransport(): NodeBuilder {
  const root = new NodeBuilder('ALLY_TRANSPORT');
  root.add(
    'fWhite',
    fuselage(
      [
        [-16.5, 0.5],
        [-12.5, 1.5],
        [-8, 2.35],
        [7, 2.45],
        [11, 2.25],
        [14, 1.55],
        [15.8, 0.5],
        [16.2, 0.1],
      ],
      18
    ),
    [0, 0, 0],
    [0, 0, 0],
    [1, 1.05, 1]
  );
  // 机身蓝色腰线
  for (const side of [1, -1]) {
    root.add('fBlue', box(0.06, 0.45, 24), [side * 2.43, 0.1, 0.5]);
    root.add('fGrey', box(0.9, 1.0, 6.5), [side * 2.2, -1.75, 0.5]);
  }
  root.add('glass', box(2.4, 0.7, 1.0), [0, 1.1, 13.2], [0.5, 0, 0]);
  // 上单翼
  root.add('fWhite', wing(20, 5.6, 2.8, 1.3, 0.5, -0.02), [0, 2.45, 3.2]);
  for (const side of [1, -1]) {
    for (const x of [5.2, 10.4]) {
      root.add('fGrey', cylZ(0.62, 0.7, 4.6, 12), [side * x, 1.95, 1.6]);
      addProp(root, [side * x, 1.95, 4.05], 2.1, 4, 'fBlue');
    }
    addRoundel(root, [side * 14.5, 2.45 + 0.3 - 14.5 * 0.02, 0.2], 1.25, 'up');
    addRoundel(root, [side * 2.5, 0.25, -6.5], 1.0, side > 0 ? 'port' : 'starboard');
  }
  root.add('navRed', sphere(0.24, 6, 4), [20.1, 2.1, 1.0]);
  root.add('navGreen', sphere(0.24, 6, 4), [-20.1, 2.1, 1.0]);
  // T 型尾翼
  root.add('fBlue', fin(7.0, 5.6, 3.0, 3.6, 0.42), [0, 1.6, -10.4]);
  root.add('fWhite', wing(7.0, 3.4, 1.8, 1.4, 0.32, 0), [0, 8.5, -13.6]);
  root.add('fGold', box(0.46, 0.4, 2.4), [0, 6.0, -14.6]);
  root.add('beacon', sphere(0.26, 8, 6), [0, 2.6, -2]);
  return root;
}

/** 民航客机：白色机身 + 青 / 橙涂装腰线、舷窗、翼下双发、航行灯与防撞闪灯 */
export function buildCivilianAirliner(): NodeBuilder {
  const root = new NodeBuilder('CIVILIAN_AIRLINER');
  addAirlinerFrame(root, 'cWhite', 40, 2.0);
  // 涂装腰线
  for (const side of [1, -1]) {
    root.add('cTeal', box(0.06, 0.5, 30), [side * 1.97, -0.25, 0.5]);
    root.add('cOrange', box(0.06, 0.14, 30), [side * 1.98, -0.62, 0.5]);
    // 舷窗
    for (let i = 0; i < 22; i++) {
      root.add('glass', box(0.06, 0.34, 0.28), [side * 1.99, 0.42, -12.5 + i * 1.18]);
    }
    root.add('glass', box(0.06, 0.9, 0.5), [side * 1.9, 0.0, 14.5]);
  }
  root.add('glass', box(1.9, 0.5, 0.8), [0, 0.95, 17.4], [0.55, 0, 0]);
  root.add('cTeal', box(1.6, 0.06, 20), [0, 2.0, 0]);
  // 机翼与翼梢小翼
  root.add('cWhite', wing(17, 6.6, 1.8, 6.4, 0.4, 0.09), [0, -1.05, 3.4]);
  for (const side of [1, -1]) {
    root.add('cTeal', fin(1.6, 1.8, 0.9, 1.0, 0.1), [side * 17.0, -1.05 + 17 * 0.09, -2.9]);
    root.add('cWhite', cylZ(1.05, 1.1, 4.3, 14), [side * 6.2, -2.15 + 6.2 * 0.09, 3.2]);
    root.add('cOrange', cylZ(1.1, 1.1, 0.3, 14), [side * 6.2, -2.15 + 6.2 * 0.09, 5.3]);
    root.add('cHullBlack', cylZ(0.85, 0.85, 0.1, 14), [side * 6.2, -2.15 + 6.2 * 0.09, 5.47]);
  }
  root.add('navRed', sphere(0.26, 6, 4), [17.4, -1.05 + 17 * 0.09 + 0.2, -3.0]);
  root.add('navGreen', sphere(0.26, 6, 4), [-17.4, -1.05 + 17 * 0.09 + 0.2, -3.0]);
  root.add('navWhite', sphere(0.24, 6, 4), [0, 0.6, -20.2]);
  root.add('beacon', sphere(0.26, 8, 6), [0, 2.08, 2]);
  root.add('beacon', sphere(0.26, 8, 6), [0, -2.08, 2]);
  // 尾翼涂装
  root.add('cTeal', fin(7.2, 6.2, 2.6, 4.8, 0.36), [0, 1.0, -13.4]);
  root.add('cOrange', sphere(1.2, 14, 8), [0.2, 4.8, -16.6], [0, 0, 0], [0.18, 1, 1]);
  root.add('cOrange', sphere(1.2, 14, 8), [-0.2, 4.8, -16.6], [0, 0, 0], [0.18, 1, 1]);
  root.add('cWhite', wing(7.0, 4.2, 1.6, 3.4, 0.3, 0.06), [0, 0.6, -14.8]);
  return root;
}
