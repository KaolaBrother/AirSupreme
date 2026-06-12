import * as THREE from 'three';
import { ParticleSystem, getVfxTextures } from '@/features/effects/ParticleSystem';
import { HealthSystem } from '@/features/combat/HealthSystem';
import { BOSS_MISSILE_CONFIG } from './BossTypes';

const BOSS_MISSILE_TRAIL_INTERVAL = 0.04;

// 弹体基准尺寸（乘以 BOSS_MISSILE_CONFIG.SCALE）。
// 两级反舰/弹道混合构型：总长 ≈ 4.66 × SCALE ≈ 18.6 单位，
// 主级直径 0.52 × SCALE、助推器直径 0.64 × SCALE → 玩家导弹的“恐怖大哥”体量
const BOSS_BODY_RADIUS = 0.26;
const BOSS_BOOSTER_RADIUS = 0.32;
const BOSS_TAIL_Z = -2.35;
const BOSS_NOSE_Z = 2.31;
// 弹体慢速滚转（弧度/秒），飞行朝向由外层 Group 四元数控制，不受影响
const BOSS_ROLL_SPEED = 0.45;

/**
 * 弹体纵剖面（半径, 轴向位置，未乘 SCALE），从尾到头，车削成两级一体弹体：
 * 收口喷管 → 尾裙 → 助推器段 → 凸起分离环 → 级间收束 → 主级弹体 → 大型雷达罩
 */
const BOSS_HULL_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.2, BOSS_TAIL_Z], // 喷口缘
  [0.245, -2.31], // 喷口外唇
  [0.275, -2.18], // 尾裙
  [0.305, -2.0],
  [BOSS_BOOSTER_RADIUS, -1.86], // 助推器最大半径
  [BOSS_BOOSTER_RADIUS, -1.02], // 助推器段
  [0.336, -0.97], // 凸起分离环
  [0.336, -0.86],
  [0.3, -0.81], // 级间收束
  [0.27, -0.74],
  [BOSS_BODY_RADIUS, -0.66],
  [BOSS_BODY_RADIUS, 1.28], // 主级弹体
  [0.2515, 1.32], // 头部舱段接缝凹槽
  [BOSS_BODY_RADIUS, 1.36],
  [0.247, 1.58], // 大型卵形雷达罩
  [0.214, 1.81],
  [0.165, 2.01],
  [0.105, 2.17],
  [0.05, 2.27],
  [0.0, BOSS_NOSE_Z], // 弹尖
];

/**
 * 车削弹体：按轴向位置重映射 v 坐标，使画布贴图能精确对位分段涂装
 */
function createHullGeometry(
  profile: ReadonlyArray<readonly [number, number]>,
  radialSegments: number,
  scale: number
): THREE.LatheGeometry {
  const points = profile.map(([radius, z]) => new THREE.Vector2(radius * scale, z * scale));
  const geometry = new THREE.LatheGeometry(points, radialSegments);
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  const span = maxY - minY || 1;
  for (let i = 0; i < position.count; i++) {
    uv.setY(i, (position.getY(i) - minY) / span);
  }
  uv.needsUpdate = true;
  geometry.rotateX(Math.PI / 2); // 车削轴 +Y → +Z 朝前
  return geometry;
}

/**
 * 薄翼面：在（弦向, 展向）平面定义平面形状后挤出厚度并倒角。
 * 输出几何体弦向沿 +Z、展向沿 +Y、厚度沿 X，原点位于翼根弦线中点。
 */
function createFinGeometry(
  outline: ReadonlyArray<readonly [number, number]>,
  thickness: number,
  bevel: number
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    shape.lineTo(outline[i][0], outline[i][1]);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 1.4,
    bevelSegments: 1,
  });
  geometry.translate(0, 0, -thickness / 2);
  geometry.rotateY(-Math.PI / 2);
  return geometry;
}

/**
 * 尾焰锥：尖端朝 -Z（向后），原点锚定在焰口平面，长度向后伸展
 */
function createFlameGeometry(radius: number, length: number, segments: number): THREE.ConeGeometry {
  const geometry = new THREE.ConeGeometry(radius, length, segments, 1, true);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, -length / 2);
  return geometry;
}

let bossBodySkin: THREE.Texture | null | undefined;

/** Boss 弹体程序化涂装贴图（构建一次全弹共享）：装甲拼板 / 传感器视窗 / 危险条纹 / 大型弦号 */
function getBossBodySkin(): THREE.Texture | null {
  if (bossBodySkin === undefined) {
    bossBodySkin = createBossBodySkin();
  }
  return bossBodySkin;
}

function createBossBodySkin(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const width = 256;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // u = 周向，v = 轴向（弹尖在画布顶端）
  const zSpan = BOSS_NOSE_Z - BOSS_TAIL_Z;
  const zToPx = (z: number): number => ((BOSS_NOSE_Z - z) / zSpan) * height;
  const paintBand = (zFront: number, zBack: number, color: string): void => {
    const top = zToPx(zFront);
    ctx.fillStyle = color;
    ctx.fillRect(0, top, width, zToPx(zBack) - top);
  };
  const paintSeam = (z: number, color: string, thickness = 2): void => {
    ctx.fillStyle = color;
    ctx.fillRect(0, Math.round(zToPx(z)), width, thickness);
  };
  const stencil = (text: string, u: number, z: number, font: string, color: string): void => {
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.translate(u, zToPx(z));
    ctx.rotate(Math.PI / 2);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };

  // 基础：暗深红装甲底漆 + 拼板色差（深红/枪铁交错）
  paintBand(BOSS_NOSE_Z, BOSS_TAIL_Z, '#4f181d');
  const plateTints = [
    'rgba(36,38,44,0.22)',
    'rgba(110,32,36,0.30)',
    'rgba(18,8,10,0.22)',
    'rgba(122,54,42,0.14)',
  ];
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = plateTints[i % plateTints.length];
    ctx.fillRect(
      Math.random() * width,
      Math.random() * height,
      20 + Math.random() * 42,
      14 + Math.random() * 30
    );
  }

  // 细装甲缝线（横向板缝 + 主级纵缝）
  ctx.strokeStyle = 'rgba(18,6,8,0.6)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    ctx.strokeRect(-2, Math.random() * height, width + 4, 18 + Math.random() * 40);
  }
  for (let i = 0; i < 6; i++) {
    const u = (i / 6) * width + 8;
    ctx.beginPath();
    ctx.moveTo(u, zToPx(1.28));
    ctx.lineTo(u, zToPx(-0.66));
    ctx.stroke();
  }

  // 枪铁黑雷达罩 + 断续传感器视窗带（青色冷光）
  paintBand(BOSS_NOSE_Z, 1.56, '#1b1418');
  paintBand(1.94, 1.8, '#08090d');
  ctx.fillStyle = '#36d8ea';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(i * 64 + 10, Math.round(zToPx(1.885)), 30, 2);
  }
  paintSeam(1.56, '#0f0b0d', 3);

  // 主级舱段缝 / 级间过渡 / 分离环琥珀标线
  paintSeam(1.32, '#2a0d10');
  paintSeam(-0.66, '#2a0d10');
  paintBand(-0.78, -0.84, '#c8861f');
  paintSeam(-1.02, '#2a0d10');

  // 喷口前的黑黄危险条纹带（助推器尾段）
  const hazardTop = zToPx(-1.98);
  const hazardBottom = zToPx(-2.2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, hazardTop, width, hazardBottom - hazardTop);
  ctx.clip();
  ctx.fillStyle = '#d99a26';
  ctx.fillRect(0, hazardTop, width, hazardBottom - hazardTop);
  ctx.fillStyle = '#15130f';
  for (let x = -32; x < width + 32; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, hazardBottom);
    ctx.lineTo(x + 16, hazardTop);
    ctx.lineTo(x + 32, hazardTop);
    ctx.lineTo(x + 16, hazardBottom);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 大型弦侧编号 + 级段蚀刻 + 警示文字
  stencil('HX-09', 36, 1.2, 'bold 26px monospace', 'rgba(206,184,162,0.88)');
  stencil('HX-09', 164, 1.2, 'bold 26px monospace', 'rgba(206,184,162,0.88)');
  stencil('DANGER', 104, 0.55, 'bold 11px monospace', 'rgba(216,154,38,0.8)');
  stencil('STAGE-2', 36, -1.12, 'bold 12px monospace', 'rgba(206,184,162,0.65)');
  stencil('STAGE-2', 164, -1.12, 'bold 12px monospace', 'rgba(206,184,162,0.65)');

  // 分离环上方的警示三角
  ctx.fillStyle = 'rgba(217,154,38,0.85)';
  for (let i = 0; i < 4; i++) {
    const u = i * 64 + 24;
    const y = zToPx(-0.55);
    ctx.beginPath();
    ctx.moveTo(u, y);
    ctx.lineTo(u + 12, y);
    ctx.lineTo(u + 6, y - 10);
    ctx.closePath();
    ctx.fill();
  }

  // 战损/污渍噪点
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = `rgba(0,0,0,${(0.04 + Math.random() * 0.06).toFixed(3)})`;
    ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Boss 重型导弹共享几何体（全部预旋转为 +Z 朝前，烘焙 SCALE）
 */
interface BossMissileGeometries {
  hull: THREE.LatheGeometry;
  tailFin: THREE.ExtrudeGeometry;
  strake: THREE.ExtrudeGeometry;
  conduit: THREE.BoxGeometry;
  armorPlate: THREE.BoxGeometry;
  finTipLight: THREE.BoxGeometry;
  separationRing: THREE.TorusGeometry;
  nozzleRing: THREE.TorusGeometry;
  nozzleCup: THREE.CylinderGeometry;
  flameCore: THREE.ConeGeometry;
  flameMid: THREE.ConeGeometry;
  flameOuter: THREE.ConeGeometry;
}

let sharedBossMissileGeometries: BossMissileGeometries | null = null;

function getBossMissileGeometries(): BossMissileGeometries {
  if (!sharedBossMissileGeometries) {
    const s = BOSS_MISSILE_CONFIG.SCALE;

    // 两级一体车削弹体（含分离环凸起与收口喷管，约 900 三角形）
    const hull = createHullGeometry(BOSS_HULL_PROFILE, 24, s);
    // 大型切角三角尾翼（X 布局，助推器段）
    const tailFin = createFinGeometry(
      [
        [0.5 * s, 0],
        [-0.1 * s, 0.55 * s],
        [-0.38 * s, 0.55 * s],
        [-0.5 * s, 0],
      ],
      0.06 * s,
      0.012 * s
    );
    // 助推器低展弦比边条（+ 布局）
    const strake = createFinGeometry(
      [
        [0.5 * s, 0],
        [0.34 * s, 0.1 * s],
        [-0.38 * s, 0.1 * s],
        [-0.5 * s, 0],
      ],
      0.04 * s,
      0.008 * s
    );
    // 主级电缆导管 / 装甲检修护板 / 翼尖警示灯
    const conduit = new THREE.BoxGeometry(0.07 * s, 0.05 * s, 1.9 * s);
    const armorPlate = new THREE.BoxGeometry(0.22 * s, 0.028 * s, 0.5 * s);
    const finTipLight = new THREE.BoxGeometry(0.05 * s, 0.04 * s, 0.16 * s);
    // 级间分离环 + 喷口环 + 喷管内衬
    const separationRing = new THREE.TorusGeometry(0.345 * s, 0.022 * s, 6, 20);
    const nozzleRing = new THREE.TorusGeometry(0.225 * s, 0.04 * s, 6, 16);
    const nozzleCup = new THREE.CylinderGeometry(0.16 * s, 0.2 * s, 0.32 * s, 16, 1, true);
    nozzleCup.rotateX(Math.PI / 2);
    // 三层尾焰：白热焰芯 / 橙红主焰 / 热霾外晕
    const flameCore = createFlameGeometry(0.1 * s, 1.1 * s, 8);
    const flameMid = createFlameGeometry(0.165 * s, 1.7 * s, 10);
    const flameOuter = createFlameGeometry(0.25 * s, 2.4 * s, 12);

    sharedBossMissileGeometries = {
      hull,
      tailFin,
      strake,
      conduit,
      armorPlate,
      finTipLight,
      separationRing,
      nozzleRing,
      nozzleCup,
      flameCore,
      flameMid,
      flameOuter,
    };
  }
  return sharedBossMissileGeometries;
}

/** 静态外观材质（不参与脉动动画，全弹共享，不随单发销毁） */
interface BossMissileStaticMaterials {
  fin: THREE.MeshStandardMaterial;
  greeble: THREE.MeshStandardMaterial;
  nozzleCup: THREE.MeshStandardMaterial;
}

let sharedBossMissileMaterials: BossMissileStaticMaterials | null = null;

function getBossMissileStaticMaterials(): BossMissileStaticMaterials {
  if (!sharedBossMissileMaterials) {
    sharedBossMissileMaterials = {
      // 枪铁色翼面
      fin: new THREE.MeshStandardMaterial({
        color: 0x23262b,
        metalness: 0.85,
        roughness: 0.35,
      }),
      // 导管/护板等机械附件：近黑哑光金属
      greeble: new THREE.MeshStandardMaterial({
        color: 0x1b1d21,
        metalness: 0.8,
        roughness: 0.5,
      }),
      // 喷管内衬
      nozzleCup: new THREE.MeshStandardMaterial({
        color: 0x17171b,
        metalness: 0.95,
        roughness: 0.3,
        emissive: 0x331106,
        emissiveIntensity: 0.6,
        side: THREE.DoubleSide,
      }),
    };
  }
  return sharedBossMissileMaterials;
}

/** 逐发动画材质（威胁脉动/尾焰闪烁会修改它们，每次装配新建，战斗实例随单发销毁） */
interface BossMissileAnimatedMaterials {
  body: THREE.MeshStandardMaterial;
  ring: THREE.MeshStandardMaterial;
  thrust: THREE.MeshBasicMaterial;
  midThrust: THREE.MeshBasicMaterial;
  innerThrust: THREE.MeshBasicMaterial;
  engineGlow: THREE.SpriteMaterial;
}

function createBossMissileAnimatedMaterials(): BossMissileAnimatedMaterials {
  const skin = getBossBodySkin();
  return {
    // 弹体材质随威胁脉动（贴图为模块级共享，不随单发销毁）
    body: new THREE.MeshStandardMaterial({
      color: skin ? 0xffffff : 0x5e1b1f,
      map: skin,
      emissive: 0x3c0303,
      emissiveIntensity: 0.18,
      metalness: 0.55,
      roughness: 0.42,
    }),
    ring: new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff6600,
      emissiveIntensity: 0.72,
    }),
    thrust: new THREE.MeshBasicMaterial({
      color: 0xff3a10,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    midThrust: new THREE.MeshBasicMaterial({
      color: 0xff7a22,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    innerThrust: new THREE.MeshBasicMaterial({
      color: 0xfff0b0,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    engineGlow: new THREE.SpriteMaterial({
      map: getVfxTextures().glow,
      color: 0xff6a33,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  };
}

/** 装配产物中需要逐帧动画的节点 */
interface BossMissileModelParts {
  rollGroup: THREE.Group;
  flameOuter: THREE.Mesh;
  flameMid: THREE.Mesh;
  flameCore: THREE.Mesh;
  engineGlow: THREE.Sprite;
}

/**
 * 装配两级重型反舰/弹道混合弹模型（仅视觉，+Z 朝前），战斗实例与预览工厂共用：
 * 一体车削弹体（助推器 + 分离环 + 主级 + 大型雷达罩，装甲拼板/传感器视窗/
 * 危险条纹/弦号涂装在共享画布贴图上）+ 主级电缆导管与装甲护板 greeble
 * + 大型 X 布局尾翼与 + 布局助推器边条（翼尖警示灯）+ 凹陷喷管
 * + 威胁脉动发光环 + 三层尾焰与引擎光晕，弹体部分置于滚转组内。
 * 体量明显大于玩家导弹（总长 ≈ 4.66 × SCALE ≈ 18.6 单位）。
 * 所有节点都引用模块级共享几何体/静态材质/贴图，统一标记
 * userData.sharedResource，预览画廊销毁时会跳过这些共享资源。
 */
function assembleBossMissileModel(
  group: THREE.Group,
  materials: BossMissileAnimatedMaterials
): BossMissileModelParts {
  const s = BOSS_MISSILE_CONFIG.SCALE;
  const geometries = getBossMissileGeometries();
  const staticMaterials = getBossMissileStaticMaterials();

  // 滚转组：弹体/附件/翼面随飞行缓慢滚转（飞行朝向由外层 Group 控制）
  const rollGroup = new THREE.Group();
  group.add(rollGroup);

  const addRolling = (object: THREE.Object3D): void => {
    object.userData.sharedResource = true;
    rollGroup.add(object);
  };
  const add = (object: THREE.Object3D): void => {
    object.userData.sharedResource = true;
    group.add(object);
  };

  // 两级一体车削弹体
  addRolling(new THREE.Mesh(geometries.hull, materials.body));

  // 凹陷喷管内衬 + 喷口警示环（随威胁脉动）
  const nozzleCup = new THREE.Mesh(geometries.nozzleCup, staticMaterials.nozzleCup);
  nozzleCup.position.z = -2.18 * s;
  addRolling(nozzleCup);

  const nozzleRing = new THREE.Mesh(geometries.nozzleRing, materials.ring);
  nozzleRing.position.z = -2.33 * s;
  addRolling(nozzleRing);

  // 级间分离环（琥珀发光，与贴图上的警示三角呼应）
  const separationRing = new THREE.Mesh(geometries.separationRing, materials.ring);
  separationRing.position.z = -0.915 * s;
  addRolling(separationRing);

  // 主级电缆导管（3 条，沿弹轴的凸起线缆槽）
  const conduitOffset = (BOSS_BODY_RADIUS + 0.018) * s;
  for (let i = 0; i < 3; i++) {
    const angle = Math.PI / 2 + (i / 3) * Math.PI * 2;
    const conduit = new THREE.Mesh(geometries.conduit, staticMaterials.greeble);
    conduit.position.set(Math.cos(angle) * conduitOffset, Math.sin(angle) * conduitOffset, 0.3 * s);
    conduit.rotation.z = angle - Math.PI / 2;
    addRolling(conduit);
  }

  // 装甲检修护板（错落分布在主级表面）
  const plateOffset = (BOSS_BODY_RADIUS + 0.008) * s;
  const plateSlots: ReadonlyArray<readonly [number, number]> = [
    [Math.PI / 4, 0.9],
    [(3 * Math.PI) / 4, 0.35],
    [(5 * Math.PI) / 4, 0.8],
    [(7 * Math.PI) / 4, -0.1],
  ];
  for (const [angle, z] of plateSlots) {
    const plate = new THREE.Mesh(geometries.armorPlate, staticMaterials.greeble);
    plate.position.set(Math.cos(angle) * plateOffset, Math.sin(angle) * plateOffset, z * s);
    plate.rotation.z = angle - Math.PI / 2;
    addRolling(plate);
  }

  // 助推器边条（+ 布局）+ 大型尾翼（X 布局）+ 翼尖警示灯
  const strakeOffset = (BOSS_BOOSTER_RADIUS - 0.01) * s;
  const finOffset = 0.28 * s;
  for (let i = 0; i < 4; i++) {
    const strakeAngle = (i / 4) * Math.PI * 2;
    const strake = new THREE.Mesh(geometries.strake, staticMaterials.fin);
    strake.position.set(
      Math.cos(strakeAngle) * strakeOffset,
      Math.sin(strakeAngle) * strakeOffset,
      -1.5 * s
    );
    strake.rotation.z = strakeAngle - Math.PI / 2;
    addRolling(strake);

    const finAngle = strakeAngle + Math.PI / 4;
    const fin = new THREE.Mesh(geometries.tailFin, staticMaterials.fin);
    fin.position.set(Math.cos(finAngle) * finOffset, Math.sin(finAngle) * finOffset, -1.78 * s);
    fin.rotation.z = finAngle - Math.PI / 2;
    addRolling(fin);

    const tipLight = new THREE.Mesh(geometries.finTipLight, materials.ring);
    tipLight.position.set(Math.cos(finAngle) * 0.8 * s, Math.sin(finAngle) * 0.8 * s, -2.0 * s);
    tipLight.rotation.z = finAngle - Math.PI / 2;
    addRolling(tipLight);
  }

  // 三层尾焰：焰口锚定喷管，向后伸展（高频闪烁见 updateVisuals）
  const flameCore = new THREE.Mesh(geometries.flameCore, materials.innerThrust);
  flameCore.position.z = -2.2 * s;
  add(flameCore);

  const flameMid = new THREE.Mesh(geometries.flameMid, materials.midThrust);
  flameMid.position.z = -2.28 * s;
  add(flameMid);

  const flameOuter = new THREE.Mesh(geometries.flameOuter, materials.thrust);
  flameOuter.position.z = -2.32 * s;
  add(flameOuter);

  // 引擎光晕 sprite：让 Boss 导弹在远距离也读得到威胁
  const engineGlow = new THREE.Sprite(materials.engineGlow);
  const glowSize = BOSS_BODY_RADIUS * s * 4.2;
  engineGlow.scale.set(glowSize, glowSize, 1);
  engineGlow.position.z = -2.4 * s;
  add(engineGlow);

  return { rollGroup, flameOuter, flameMid, flameCore, engineGlow };
}

/**
 * 预览工厂：仅装配 Boss 导弹视觉模型（不需要场景/粒子系统/目标）。
 * 动画材质为全新实例，模型画廊不会改动战斗弹使用的材质。
 */
export function createBossMissileVisualMesh(): THREE.Group {
  const group = new THREE.Group();
  assembleBossMissileModel(group, createBossMissileAnimatedMaterials());
  return group;
}

export class BossMissile {
  public mesh: THREE.Group;
  public velocity: THREE.Vector3;
  public target: THREE.Object3D | null = null;
  public active: boolean = true;
  public lifetime: number = 0;
  public isTargetingPlayer: boolean = false;

  private turnSpeed: number = 0.25;
  private speed: number = 50;
  private particleSystem: ParticleSystem;
  private health: HealthSystem;
  private startPosition: THREE.Vector3;
  private potentialTargets: THREE.Object3D[] = [];
  private playerMesh: THREE.Object3D | null = null;
  private trailTimer: number = BOSS_MISSILE_TRAIL_INTERVAL;
  private visualPulseTime: number = 0;
  private readonly lookTarget = new THREE.Vector3();
  private readonly orientationHelper = new THREE.Object3D();
  private readonly trailPosition = new THREE.Vector3();
  private readonly backwardDirection = new THREE.Vector3();
  private readonly trailColor = new THREE.Color();
  private readonly targetPosition = new THREE.Vector3();
  private readonly targetDirection = new THREE.Vector3();
  private readonly currentDirection = new THREE.Vector3();
  private readonly ownedMaterials: THREE.Material[] = [];
  private bodyMaterial!: THREE.MeshStandardMaterial;
  private ringMaterial!: THREE.MeshStandardMaterial;
  private thrustMaterial!: THREE.MeshBasicMaterial;
  private midThrustMaterial!: THREE.MeshBasicMaterial;
  private innerThrustMaterial!: THREE.MeshBasicMaterial;
  private engineGlowMaterial!: THREE.SpriteMaterial;
  private engineGlow!: THREE.Sprite;
  private rollGroup!: THREE.Group;
  private flameOuter!: THREE.Mesh;
  private flameMid!: THREE.Mesh;
  private flameCore!: THREE.Mesh;

  constructor(
    scene: THREE.Scene,
    position: THREE.Vector3,
    target: THREE.Object3D | null,
    particleSystem: ParticleSystem,
    potentialTargets: THREE.Object3D[] = [],
    playerMesh: THREE.Object3D | null = null
  ) {
    this.particleSystem = particleSystem;
    this.target = target;
    this.potentialTargets = potentialTargets;
    this.playerMesh = playerMesh;
    this.startPosition = position.clone();
    this.health = new HealthSystem(BOSS_MISSILE_CONFIG.HEALTH);

    // 判断初始目标是否是玩家
    if (!target && playerMesh) {
      this.isTargetingPlayer = true;
    }

    this.health.onDeath = () => {
      this.active = false;
      this.particleSystem.createBossMissileExplosion(this.mesh.position.clone(), 1.6);
    };

    this.mesh = new THREE.Group();
    this.buildMissileModel();

    this.mesh.position.copy(position);
    scene.add(this.mesh);

    this.velocity = new THREE.Vector3(0, this.speed, 0);

    this.lookTarget.copy(this.mesh.position).add(this.velocity);
    this.mesh.lookAt(this.lookTarget);
  }

  /**
   * 构建导弹模型：装配逻辑与预览工厂共用（见 assembleBossMissileModel），
   * 战斗实例持有动画材质与滚转组引用以驱动威胁脉动/尾焰闪烁/慢速滚转，
   * 动画材质随单发销毁。
   */
  private buildMissileModel(): void {
    const materials = createBossMissileAnimatedMaterials();
    this.bodyMaterial = materials.body;
    this.ringMaterial = materials.ring;
    this.thrustMaterial = materials.thrust;
    this.midThrustMaterial = materials.midThrust;
    this.innerThrustMaterial = materials.innerThrust;
    this.engineGlowMaterial = materials.engineGlow;
    this.ownedMaterials.push(
      materials.body,
      materials.ring,
      materials.thrust,
      materials.midThrust,
      materials.innerThrust,
      materials.engineGlow
    );

    const parts = assembleBossMissileModel(this.mesh, materials);
    this.rollGroup = parts.rollGroup;
    this.flameOuter = parts.flameOuter;
    this.flameMid = parts.flameMid;
    this.flameCore = parts.flameCore;
    this.engineGlow = parts.engineGlow;
  }

  public update(deltaTime: number): void {
    if (!this.active) return;

    this.lifetime += deltaTime;

    const flightDistance = this.mesh.position.distanceTo(this.startPosition);
    if (flightDistance > BOSS_MISSILE_CONFIG.MAX_RANGE) {
      this.active = false;
      return;
    }

    if (this.mesh.position.y <= -50) {
      this.active = false;
      this.particleSystem.createBossMissileExplosion(this.mesh.position.clone(), 1.5);
      return;
    }

    if (!this.target || (!this.isTargetingPlayer && !this.target.parent)) {
      this.findNewTarget();
    }

    if (this.isTargetingPlayer || (this.target && this.target.parent)) {
      this.huntTarget(deltaTime);
    }

    this.mesh.position.addScaledVector(this.velocity, deltaTime);
    this.visualPulseTime += deltaTime;
    this.updateVisuals();

    if (this.velocity.length() > 0) {
      this.lookTarget.copy(this.mesh.position).add(this.velocity);
      this.orientationHelper.position.copy(this.mesh.position);
      this.orientationHelper.lookAt(this.lookTarget);
      this.mesh.quaternion.slerp(this.orientationHelper.quaternion, 0.3);
    }

    this.trailTimer += deltaTime;
    while (this.trailTimer >= BOSS_MISSILE_TRAIL_INTERVAL) {
      this.trailTimer -= BOSS_MISSILE_TRAIL_INTERVAL;
      this.emitTrail();
    }
  }

  private findNewTarget(): void {
    if (this.isTargetingPlayer && this.playerMesh) {
      return;
    }

    this.isTargetingPlayer = false;
    let nearestTarget: THREE.Object3D | null = null;
    let minDistance = Infinity;

    for (const potentialTarget of this.potentialTargets) {
      if (potentialTarget.parent) {
        const dist = this.mesh.position.distanceTo(potentialTarget.position);
        if (dist < minDistance) {
          minDistance = dist;
          nearestTarget = potentialTarget;
        }
      }
    }

    if (nearestTarget) {
      this.target = nearestTarget;
      return;
    }

    if (this.playerMesh) {
      this.isTargetingPlayer = true;
    }
  }

  private huntTarget(deltaTime: number): void {
    if (this.isTargetingPlayer && this.playerMesh) {
      this.targetPosition.copy(this.playerMesh.position);
    } else if (this.target) {
      this.targetPosition.copy(this.target.position);
    } else {
      return;
    }

    this.targetDirection.subVectors(this.targetPosition, this.mesh.position).normalize();
    this.currentDirection.copy(this.velocity).normalize();
    const turnAngle = this.turnSpeed * deltaTime;

    this.currentDirection.lerp(this.targetDirection, turnAngle * 2);
    this.currentDirection.normalize();
    this.velocity.copy(this.currentDirection).multiplyScalar(this.speed);
  }

  private emitTrail(): void {
    this.trailPosition.copy(this.mesh.position);
    this.backwardDirection
      .copy(this.velocity)
      .normalize()
      .multiplyScalar(-1.5 * BOSS_MISSILE_CONFIG.SCALE);
    this.trailPosition.add(this.backwardDirection);
    this.trailColor.setHSL(0.045 + Math.random() * 0.02, 1, 0.58);
    this.particleSystem.createBossMissileTrail(this.trailPosition, this.velocity);
  }

  private updateVisuals(): void {
    const t = this.visualPulseTime;
    // 高频双频闪烁的尾焰 + 较慢的弹体威胁脉动
    const pulse = 0.7 + Math.sin(t * 18) * 0.2;
    const flicker = 0.5 + 0.3 * Math.sin(t * 46) + 0.2 * Math.sin(t * 73 + 1.3);
    this.bodyMaterial.emissiveIntensity = 0.12 + pulse * 0.16;
    this.ringMaterial.emissiveIntensity = 0.56 + pulse * 0.42;

    // 弹体缓慢滚转（朝向由外层 Group 的四元数控制，不受影响）
    this.rollGroup.rotation.z = t * BOSS_ROLL_SPEED;

    // 三层尾焰：焰口锚定喷管，焰长与径向随闪烁抖动
    this.thrustMaterial.opacity = 0.18 + flicker * 0.16;
    const outerScale = 0.85 + flicker * 0.3;
    this.flameOuter.scale.set(outerScale, outerScale, 0.8 + flicker * 0.45);

    this.midThrustMaterial.opacity = 0.5 + flicker * 0.35;
    const midScale = 0.85 + flicker * 0.3;
    this.flameMid.scale.set(midScale, midScale, 0.82 + flicker * 0.42);

    this.innerThrustMaterial.opacity = 0.7 + flicker * 0.3;
    const coreScale = 0.88 + flicker * 0.28;
    this.flameCore.scale.set(coreScale, coreScale, 0.85 + flicker * 0.45);

    this.engineGlowMaterial.opacity = 0.5 + flicker * 0.4;
    const glowPulse = 1 + flicker * 0.45;
    const glowBase = BOSS_BODY_RADIUS * BOSS_MISSILE_CONFIG.SCALE * 4.2;
    this.engineGlow.scale.set(glowBase * glowPulse, glowBase * glowPulse, 1);
  }

  public takeDamage(damage: number): void {
    this.particleSystem.createHit(this.mesh.position, 1.2);
    this.health.takeDamage(damage);
  }

  public getMesh(): THREE.Group {
    return this.mesh;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    for (const material of this.ownedMaterials) {
      material.dispose();
    }
    this.ownedMaterials.length = 0;
    this.active = false;
  }
}

export class BossMissileSystem {
  private scene: THREE.Scene;
  private particleSystem: ParticleSystem;
  private missiles: BossMissile[] = [];

  constructor(scene: THREE.Scene, particleSystem: ParticleSystem) {
    this.scene = scene;
    this.particleSystem = particleSystem;
  }

  public fire(
    position: THREE.Vector3,
    target: THREE.Object3D | null,
    potentialTargets: THREE.Object3D[] = [],
    playerMesh: THREE.Object3D | null = null,
    targetingPlayer: boolean = false
  ): void {
    const missile = new BossMissile(
      this.scene,
      position,
      target,
      this.particleSystem,
      potentialTargets,
      playerMesh
    );
    missile.isTargetingPlayer = targetingPlayer;
    this.missiles.push(missile);
  }

  public update(deltaTime: number): void {
    for (const missile of this.missiles) {
      if (missile.active) {
        missile.update(deltaTime);
      }
    }

    this.missiles = this.missiles.filter((m) => {
      if (!m.active) {
        m.dispose(this.scene);
        return false;
      }
      return true;
    });
  }

  public getMissiles(): BossMissile[] {
    return this.missiles.filter((m) => m.active);
  }

  public getMissileMeshes(): THREE.Object3D[] {
    return this.missiles.filter((m) => m.active).map((m) => m.mesh);
  }

  public checkCollisions(
    targetMeshes: THREE.Object3D[],
    onHit: (target: THREE.Object3D, damage: number) => void
  ): void {
    for (const missile of this.missiles) {
      if (!missile.active) continue;

      for (const targetMesh of targetMeshes) {
        if (!targetMesh.parent) continue;

        const distance = missile.mesh.position.distanceTo(targetMesh.position);
        const hitDistance = 5 + BOSS_MISSILE_CONFIG.SCALE;

        if (distance < hitDistance) {
          missile.active = false;
          this.particleSystem.createBossMissileExplosion(missile.mesh.position.clone(), 1.45);
          onHit(targetMesh, BOSS_MISSILE_CONFIG.DAMAGE);
          break;
        }
      }
    }
  }

  public dispose(): void {
    for (const missile of this.missiles) {
      missile.dispose(this.scene);
    }
    this.missiles = [];
  }
}
