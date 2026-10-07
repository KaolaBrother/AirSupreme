import {
  NodeBuilder,
  addHostileMark,
  addRoundel,
  box,
  coneZ,
  cyl,
  cylZ,
  foamStrip,
  fuselage,
  hull,
  sphere,
  torus,
  type PaletteKey,
} from './UnitMeshKit';

/**
 * 海上单位模型：高速炮艇、导弹护卫舰（敌 / 友两套涂装）、攻击潜艇、民用货轮。
 * 原点位于水线（水面 y），船首 +Z。尾流（wake）为可缩放子节点。
 */

function addWake(root: NodeBuilder, sternZ: number, length: number, width: number): void {
  const wake = root.child('wake', [0, 0.08, sternZ]);
  // 中央湍流尾迹
  wake.add('foam', foamStrip(0, 0.5, 0, -length, width * 0.55, width * 1.5, 0.78));
  // 开尔文波臂（约 19.5°）
  const arm = 0.34;
  const armLen = length * 0.85;
  for (const side of [1, -1]) {
    const x0 = side * width * 0.4;
    wake.add(
      'foam',
      foamStrip(x0, 0, x0 + side * Math.sin(arm) * armLen, -Math.cos(arm) * armLen, 1.2, 3.4, 0.62)
    );
  }
}

function addBowSpray(root: NodeBuilder, bowZ: number, width: number): void {
  const spray = root.child('bowWake', [0, 0.1, bowZ]);
  for (const side of [1, -1]) {
    spray.add('foam', foamStrip(0, 0, side * width * 1.05, -width * 3.2, 0.7, 2.2, 0.85, 4));
  }
}

/** 船舷色带：略宽于船体、位于甲板沿下方的薄船壳，露出部分形成一圈色带 */
function addHullBand(
  root: NodeBuilder,
  key: PaletteKey,
  length: number,
  beam: number,
  deckY: number,
  bowStart: number,
  sternWidth: number,
  sheer: number
): void {
  root.add(
    key,
    hull({
      length: length * 1.005,
      beam: beam * 1.04,
      depth: 0.45,
      bowStart,
      sternWidth,
      keel: 0.95,
      sheer,
      stations: 16,
    }),
    [0, deckY - 0.3, 0.02]
  );
}

/** 高速炮艇：尖削船体、驾驶舱、前甲板炮塔（turret）、尾部机枪，红色舷带 */
export function buildGunboat(): NodeBuilder {
  const root = new NodeBuilder('GUNBOAT');
  const deckY = 1.5;
  root.add(
    'hHull',
    hull({ length: 22, beam: 5.4, depth: 2.4, bowStart: 0.5, sternWidth: 0.92, sheer: 0.9 }),
    [0, deckY, 0]
  );
  addHullBand(root, 'hRed', 22, 5.4, deckY, 0.5, 0.92, 0.9);
  root.add('deck', box(3.8, 0.05, 9), [0, deckY + 0.04, -4.5]);
  // 驾驶舱
  root.add('hDark', box(3.4, 1.7, 4.6), [0, deckY + 0.85, -1.2]);
  root.add('hDark', box(3.0, 0.8, 2.2), [0, deckY + 2.0, -1.8]);
  root.add('glass', box(3.1, 0.5, 0.08), [0, deckY + 1.35, 1.12], [-0.3, 0, 0]);
  root.add('glass', box(0.08, 0.45, 3.0), [1.71, deckY + 1.35, -1.3]);
  root.add('glass', box(0.08, 0.45, 3.0), [-1.71, deckY + 1.35, -1.3]);
  addHostileMark(root, [0, deckY + 2.42, -1.8], 0.75, 'up');
  root.add('metal', cyl(0.07, 0.09, 3.0, 6), [0, deckY + 3.9, -2.4]);
  root.add('beacon', sphere(0.18, 8, 6), [0, deckY + 5.45, -2.4]);
  const radar = root.child('radar', [0, deckY + 4.6, -2.4]);
  radar.add('hDark', box(1.8, 0.16, 0.3), [0, 0, 0]);
  radar.add('hRed', box(0.3, 0.17, 0.32), [0.75, 0, 0]);
  // 尾部机枪
  root.add('hDark', cyl(0.45, 0.5, 0.5, 10), [0, deckY + 0.25, -8.4]);
  root.add('metal', cylZ(0.07, 0.07, 1.6, 6), [0.2, deckY + 0.7, -7.8]);
  root.add('metal', cylZ(0.07, 0.07, 1.6, 6), [-0.2, deckY + 0.7, -7.8]);
  root.add('hRed', box(0.5, 0.5, 0.06), [0, deckY + 0.45, -10.95]);
  // 前甲板炮塔
  const turret = root.child('turret', [0, deckY + 0.1, 5.3]);
  turret.add('hHull', cyl(0.85, 0.95, 0.5, 12), [0, 0.25, 0]);
  turret.add('hDark', box(1.3, 0.85, 1.3), [0, 0.85, 0.05]);
  turret.add('hRed', box(1.32, 0.12, 1.32), [0, 1.2, 0.05]);
  turret.add('metal', cylZ(0.1, 0.12, 2.4, 8), [0, 0.85, 1.85]);
  turret.child('muzzle', [0, 0.85, 3.1]);
  addWake(root, -11, 30, 5.4);
  addBowSpray(root, 9.5, 2.6);
  return root;
}

interface FrigatePalette {
  hullKey: PaletteKey;
  bandKey: PaletteKey;
  superKey: PaletteKey;
  darkKey: PaletteKey;
  accentKey: PaletteKey;
  glowKey: PaletteKey;
  friendly: boolean;
}

/** 护卫舰（共用造型，敌 / 友两套涂装与舰徽） */
function buildFrigateShape(name: string, palette: FrigatePalette): NodeBuilder {
  const root = new NodeBuilder(name);
  const deckY = 3.4;
  const L = 74;
  const B = 10.5;
  root.add(
    palette.hullKey,
    hull({ length: L, beam: B, depth: 5.5, bowStart: 0.58, sternWidth: 0.8, sheer: 2.2 }),
    [0, deckY, 0]
  );
  addHullBand(root, palette.bandKey, L, B, deckY, 0.58, 0.8, 2.2);
  root.add('deck', box(7.6, 0.06, 40), [0, deckY + 0.05, -8]);
  // 舷号
  for (const side of [1, -1]) {
    root.add(palette.accentKey, box(0.06, 1.2, 0.3), [side * 5.05, deckY - 1.2, 26]);
    root.add(palette.accentKey, box(0.06, 1.2, 0.3), [side * 5.0, deckY - 1.2, 25.2]);
  }
  // 前部上层建筑 + 舰桥
  root.add(palette.superKey, box(8.2, 4.6, 15), [0, deckY + 2.3, 5]);
  root.add(palette.superKey, box(7.4, 2.4, 7), [0, deckY + 5.8, 6.5]);
  root.add('glass', box(7.2, 0.7, 0.1), [0, deckY + 6.4, 10.02]);
  root.add('glass', box(0.1, 0.6, 5.0), [3.72, deckY + 6.4, 6.6]);
  root.add('glass', box(0.1, 0.6, 5.0), [-3.72, deckY + 6.4, 6.6]);
  root.add(palette.darkKey, box(9.6, 0.25, 2.2), [0, deckY + 7.1, 9.2]);
  // 主桅（锥形）+ 旋转雷达
  root.add(palette.superKey, cyl(0.9, 2.9, 9, 4), [0, deckY + 11.5, 4.5], [0, Math.PI / 4, 0]);
  root.add(palette.darkKey, box(4.2, 0.25, 0.25), [0, deckY + 13.2, 4.5]);
  root.add('beacon', sphere(0.3, 8, 6), [0, deckY + 18.9, 4.5]);
  const radar = root.child('radar', [0, deckY + 16.4, 4.5]);
  radar.add(palette.darkKey, box(5.2, 0.9, 0.45), [0, 0.5, 0]);
  radar.add(palette.accentKey, box(5.24, 0.16, 0.48), [0, 0.95, 0]);
  radar.add('metal', cyl(0.25, 0.3, 0.6, 8), [0, -0.1, 0]);
  // 烟囱
  root.add(palette.darkKey, box(4.2, 4.4, 5.5), [0, deckY + 2.6, -5.5], [-0.12, 0, 0]);
  root.add('hDark', box(3.6, 0.3, 4.4), [0, deckY + 4.9, -5.9], [-0.12, 0, 0]);
  // 机库 + 直升机甲板
  root.add(palette.superKey, box(8.6, 4.2, 12), [0, deckY + 2.1, -15.5]);
  root.add(palette.darkKey, box(5.6, 3.4, 0.12), [0, deckY + 1.7, -21.5]);
  if (palette.friendly) {
    addRoundel(root, [0, deckY + 0.12, -29], 3.2, 'up');
    addRoundel(root, [4.32, deckY + 2.4, -15.5], 1.5, 'port');
    addRoundel(root, [-4.32, deckY + 2.4, -15.5], 1.5, 'starboard');
    root.add('fWhite', box(0.25, 0.04, 14), [0, deckY + 0.1, -29]);
  } else {
    addHostileMark(root, [0, deckY + 0.12, -29], 3.4, 'up');
    addHostileMark(root, [4.32, deckY + 2.4, -15.5], 1.4, 'port');
    addHostileMark(root, [-4.32, deckY + 2.4, -15.5], 1.4, 'starboard');
    root.add('hRed', box(8.64, 0.25, 0.2), [0, deckY + 4.05, -9.5]);
    root.add('hGlow', box(7.5, 0.12, 0.08), [0, deckY + 5.1, 10.05]);
  }
  // 垂直发射单元
  root.add(palette.darkKey, box(5.2, 0.35, 6.4), [0, deckY + 0.2, 19.5]);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 2; c++) {
      root.add(palette.accentKey, box(1.6, 0.06, 0.9), [
        -1.25 + c * 2.5,
        deckY + 0.4,
        17.2 + r * 1.55,
      ]);
    }
  }
  root.child('vls', [0, deckY + 0.8, 19.5]);
  // 舰炮
  const turret = root.child('turret', [0, deckY + 0.35, 27]);
  turret.add(
    palette.superKey,
    cyl(1.6, 1.9, 1.4, 6),
    [0, 0.7, 0],
    [0, Math.PI / 6, 0],
    [1, 1, 1.25]
  );
  turret.add(palette.darkKey, box(1.2, 0.6, 1.2), [0, 1.2, 1.4]);
  turret.add('metal', cylZ(0.16, 0.22, 5.4, 10), [0, 1.05, 3.6]);
  turret.child('muzzle', [0, 1.05, 6.4]);
  // 近防炮（机库顶）
  const ciws = root.child('ciws', [0, deckY + 4.6, -12.5]);
  ciws.add(palette.superKey, cyl(0.9, 1.0, 0.8, 12), [0, 0.4, 0]);
  ciws.add(palette.superKey, sphere(0.95, 12, 8), [0, 1.35, 0], [0, 0, 0], [1, 1.25, 1]);
  ciws.add('metal', cylZ(0.18, 0.18, 1.8, 8), [0, 0.95, 1.2]);
  ciws.child('muzzle', [0, 0.95, 2.2]);
  // 救生筏 / 舷侧细节
  for (const side of [1, -1]) {
    root.add('fWhite', cyl(0.45, 0.45, 1.6, 8), [side * 3.9, deckY + 4.9, -1], [Math.PI / 2, 0, 0]);
  }
  root.add('navRed', sphere(0.2, 6, 4), [3.85, deckY + 7.3, 9.4]);
  root.add('navGreen', sphere(0.2, 6, 4), [-3.85, deckY + 7.3, 9.4]);
  root.add(palette.glowKey, box(0.4, 0.4, 0.06), [0, deckY + 1.0, 36.6]);
  addWake(root, -37, 70, B);
  addBowSpray(root, 35, 4.6);
  return root;
}

/** 敌方导弹护卫舰：深灰舰体 + 红色舷带与识别标 */
export function buildFrigate(): NodeBuilder {
  return buildFrigateShape('FRIGATE', {
    hullKey: 'hHull',
    bandKey: 'hRed',
    superKey: 'hHull',
    darkKey: 'hDark',
    accentKey: 'hRed',
    glowKey: 'hGlow',
    friendly: false,
  });
}

/** 友军护卫舰「北辰」：海灰舰体 + 蓝色舷带 + 白色上层建筑与圆形徽标 */
export function buildAllyFrigate(): NodeBuilder {
  return buildFrigateShape('ALLY_FRIGATE', {
    hullKey: 'fGrey',
    bandKey: 'fBlue',
    superKey: 'fWhite',
    darkKey: 'fNavy',
    accentKey: 'fBlue',
    glowKey: 'fGlow',
    friendly: true,
  });
}

/** 攻击潜艇：黑色耐压壳、指挥台围壳（sail）、十字尾舵与螺旋桨（prop），可潜望深度航行 */
export function buildSubmarine(): NodeBuilder {
  const root = new NodeBuilder('SUBMARINE');
  const cy = -1.9;
  root.add(
    'hDark',
    fuselage(
      [
        [-23, 0.25],
        [-21, 1.2],
        [-17, 2.5],
        [-12, 3.1],
        [0, 3.2],
        [14, 3.2],
        [18.5, 2.9],
        [21.5, 2.0],
        [23, 0.6],
        [23.4, 0.05],
      ],
      18
    ),
    [0, cy, 0]
  );
  root.add('hHull', box(2.6, 0.14, 26), [0, cy + 3.17, 2]);
  // 指挥台围壳
  root.add('hDark', box(2.1, 4.4, 6.2), [0, cy + 5.2, 8.6]);
  root.add('hDark', cyl(1.05, 1.05, 4.4, 12), [0, cy + 5.2, 11.7]);
  root.add('hDark', box(7.4, 0.24, 1.7), [0, cy + 5.9, 9.6]);
  root.add('hRed', box(2.14, 0.3, 6.24), [0, cy + 7.1, 8.6]);
  root.add('hGlow', box(0.5, 0.24, 0.06), [0, cy + 6.2, 12.78]);
  addHostileMark(root, [0, cy + 7.42, 8.4], 0.75, 'up');
  const periscope = root.child('periscope', [0, cy + 7.4, 9.4]);
  periscope.add('metal', cyl(0.12, 0.12, 2.6, 6), [0, 1.3, 0.5]);
  periscope.add('metal', cyl(0.1, 0.1, 1.9, 6), [0.4, 0.95, -0.6]);
  periscope.add('hGlow', box(0.18, 0.14, 0.2), [0, 2.65, 0.6]);
  // 垂直发射舱口
  for (let i = 0; i < 4; i++) {
    for (const x of [0.55, -0.55]) {
      root.add('hRed', cyl(0.36, 0.36, 0.12, 10), [x, cy + 3.27, -1.5 - i * 1.6]);
    }
  }
  // 红色识别环
  root.add('hRed', torus(3.24, 0.14, 24), [0, cy, -9]);
  // 十字尾舵
  root.add('hDark', box(9.2, 0.25, 2.4), [0, cy, -19.8]);
  root.add('hDark', box(0.25, 8.0, 2.4), [0, cy, -19.8]);
  root.add('hRed', box(0.28, 1.0, 2.42), [0, cy + 3.6, -19.8]);
  const prop = root.child('prop', [0, cy, -23.3]);
  prop.add('metal', coneZ(0.5, 1.0, 10), [0, 0, -0.3], [Math.PI, 0, 0]);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    prop.add(
      'metal',
      box(0.26, 1.8, 0.1),
      [Math.sin(a) * 0.95, Math.cos(a) * 0.95, 0],
      [0.3, 0, -a]
    );
  }
  addWake(root, -22, 34, 5);
  addBowSpray(root, 21, 2.2);
  return root;
}

/** 民用货轮：黑色船体 + 白色舷线、彩色集装箱堆、尾部白色上层建筑与橙青烟囱、航行灯 */
export function buildCivilianShip(): NodeBuilder {
  const root = new NodeBuilder('CIVILIAN_SHIP');
  const deckY = 4.2;
  const L = 96;
  const B = 15;
  root.add(
    'cHullBlack',
    hull({ length: L, beam: B, depth: 8, bowStart: 0.72, sternWidth: 0.9, sheer: 2.6, keel: 0.55 }),
    [0, deckY, 0]
  );
  addHullBand(root, 'cWhite', L, B, deckY, 0.72, 0.9, 2.6);
  root.add('cHullRed', box(13.8, 0.08, 78), [0, deckY + 0.05, 2]);
  // 集装箱：5 个货舱 × 4 列 × 2-3 层
  const colors: PaletteKey[] = ['cBlueBox', 'cRedBox', 'cYellowBox', 'cGreenBox', 'cWhite'];
  let seed = 7;
  const next = (): number => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let bay = 0; bay < 5; bay++) {
    const z = 26 - bay * 13;
    for (let col = 0; col < 4; col++) {
      const x = -4.8 + col * 3.2;
      const stack = 2 + (next() > 0.45 ? 1 : 0);
      for (let tier = 0; tier < stack; tier++) {
        const key = colors[Math.floor(next() * colors.length) % colors.length];
        root.add(key, box(2.9, 2.5, 12.2), [x, deckY + 1.3 + tier * 2.6, z]);
      }
    }
  }
  // 船首桅杆与吊机
  root.add('cWhite', cyl(0.25, 0.3, 9, 6), [0, deckY + 4.5, 40]);
  root.add('navWhite', sphere(0.3, 6, 4), [0, deckY + 9.1, 40]);
  root.add('cOrange', box(0.8, 0.8, 9), [5.5, deckY + 6.2, 31], [0.5, 0, 0]);
  // 尾部上层建筑
  root.add('cWhite', box(13, 10, 9), [0, deckY + 5, -36]);
  root.add('cWhite', box(16.5, 0.5, 3.5), [0, deckY + 10.2, -32.5]);
  root.add('glass', box(13.1, 1.0, 0.1), [0, deckY + 9.0, -31.45]);
  for (let level = 0; level < 3; level++) {
    root.add('glass', box(13.06, 0.6, 0.1), [0, deckY + 2.5 + level * 2.2, -31.48]);
  }
  root.add('cTeal', box(13.04, 0.6, 9.04), [0, deckY + 0.6, -36]);
  // 烟囱
  root.add('cOrange', box(4.2, 6, 4.6), [0, deckY + 13, -39]);
  root.add('cTeal', box(4.24, 1.2, 4.64), [0, deckY + 14.3, -39]);
  root.add('cHullBlack', box(4.24, 0.8, 4.64), [0, deckY + 16.1, -39]);
  root.add('metal', cyl(0.12, 0.12, 4.5, 5), [0, deckY + 12.8, -34.5]);
  root.add('beacon', sphere(0.32, 8, 6), [0, deckY + 15.1, -34.5]);
  // 航行灯：左舷（+X）红、右舷（-X）绿
  root.add('navRed', sphere(0.36, 8, 6), [8.2, deckY + 10.3, -32.5]);
  root.add('navGreen', sphere(0.36, 8, 6), [-8.2, deckY + 10.3, -32.5]);
  root.add('navWhite', sphere(0.32, 8, 6), [0, deckY + 2.4, -47.6]);
  // 救生艇
  root.add('cOrange', cyl(0.8, 0.8, 4.2, 8), [7.2, deckY + 6.5, -36], [Math.PI / 2, 0, 0]);
  root.add('cOrange', cyl(0.8, 0.8, 4.2, 8), [-7.2, deckY + 6.5, -36], [Math.PI / 2, 0, 0]);
  addWake(root, -47, 80, B);
  addBowSpray(root, 46, 6.5);
  return root;
}
