import * as THREE from 'three';
import { ParticleSystem, getVfxTextures } from '@/features/effects/ParticleSystem';
import { GAME_CONSTANTS } from '@/config';
import { getLogger } from '@/core/utils/Logger';
import { getDeclaredHitRadius } from '@/core/CombatContracts';
import {
  beginPlayerMissileTrail,
  endPlayerMissileTrail,
} from '@/features/effects/particles/recipes/trailRecipes';

const log = getLogger('MissileSystem');
// 稍微加密尾迹步进，让烟线更连续
const MISSILE_TRAIL_INTERVAL = 0.03;
// 海面和云层背景较亮，玩家导弹默认需要高于中性的尾迹强度
const MISSILE_TRAIL_VISIBILITY_INTENSITY = 1.25;
/** 离架后沿发射方向直飞这么久才开始制导（秒）：导弹先飞离载机，不会贴着镜头急转 */
const MISSILE_BOOST_TIME = 0.2;
/** 尾焰锥与引擎光晕在这段飞行时间内从无到有（秒）：第一人称离架瞬间不会有一团白光糊住视野 */
const MISSILE_FLAME_FADE_START = 0.05;
const MISSILE_FLAME_FADE_END = 0.35;
/** 离架后这段时间不出烟（秒），之后在 RAMP 时间内把尾迹渐入 */
const MISSILE_TRAIL_DELAY = 0.3;
const MISSILE_TRAIL_RAMP_TIME = 0.6;
/** 未声明命中半径的目标（普通敌机）的近炸距离（米） */
const MISSILE_PROXIMITY_RADIUS = 6;
/** 估算出的目标速度超过它（米/秒）视为目标被瞬移 / 回收复用，本步不取前置量 */
const MISSILE_TARGET_SPEED_LIMIT = 300;
/** 预热模型至少被真实渲染这么多次后才撤下 */
const MISSILE_WARM_DRAWS = 2;

// 弹体轴向范围（+Z 朝前）：喷口缘 → 弹尖，总长 2.8
const MISSILE_TAIL_Z = -1.02;
const MISSILE_NOSE_Z = 1.78;

/**
 * 弹体纵剖面（半径, 轴向位置），从尾到头，车削成一体化弹体：
 * 收口喷管 → 船尾收束 → 发动机舱 → 战斗部舱 → 制导舱 → 卵形弹头。
 * 舱段交界处有细微的半径凹槽（接缝），配合贴图面板线增强分段感。
 */
const MISSILE_HULL_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.105, -1.02], // 喷口缘
  [0.125, -1.0], // 喷口外唇
  [0.14, -0.9], // 船尾收束
  [0.155, -0.76],
  [0.16, -0.62], // 发动机舱
  [0.16, -0.2],
  [0.1545, -0.18], // 舱段接缝凹槽
  [0.16, -0.16],
  [0.16, 0.52], // 战斗部舱
  [0.1545, 0.54], // 舱段接缝凹槽
  [0.16, 0.56],
  [0.16, 0.92], // 制导舱
  [0.152, 1.12], // 卵形弹头曲线
  [0.136, 1.32],
  [0.112, 1.49],
  [0.082, 1.62],
  [0.048, 1.72],
  [0.0, 1.78], // 弹尖
];

/**
 * 车削弹体：按轴向位置重映射 v 坐标，使画布贴图能精确对位分段涂装
 */
function createHullGeometry(
  profile: ReadonlyArray<readonly [number, number]>,
  radialSegments: number
): THREE.LatheGeometry {
  const points = profile.map(([radius, z]) => new THREE.Vector2(radius, z));
  const geometry = new THREE.LatheGeometry(points, radialSegments);
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, z] of profile) {
    if (z < minY) minY = z;
    if (z > maxY) maxY = z;
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
 * 尾焰锥：尖端朝 -Z（向后），原点锚定在焰口平面，长度向后伸展。
 * 这样 z 向缩放只拉伸焰长，焰口不会脱离喷管。
 */
function createFlameGeometry(radius: number, length: number, segments: number): THREE.ConeGeometry {
  const geometry = new THREE.ConeGeometry(radius, length, segments, 1, true);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, -length / 2);
  return geometry;
}

let missileBodySkin: THREE.Texture | null | undefined;

/** 弹体程序化涂装贴图（构建一次全弹共享）：分段涂装 / 滚转色带 / 面板线 / 模板印字 */
function getMissileBodySkin(): THREE.Texture | null {
  if (missileBodySkin === undefined) {
    missileBodySkin = createMissileBodySkin();
  }
  return missileBodySkin;
}

function createMissileBodySkin(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const width = 128;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // u = 周向，v = 轴向（弹尖在画布顶端）
  const zSpan = MISSILE_NOSE_Z - MISSILE_TAIL_Z;
  const zToPx = (z: number): number => ((MISSILE_NOSE_Z - z) / zSpan) * height;
  const paintBand = (zFront: number, zBack: number, color: string): void => {
    const top = zToPx(zFront);
    ctx.fillStyle = color;
    ctx.fillRect(0, top, width, zToPx(zBack) - top);
  };
  const paintSeam = (z: number, color: string, thickness = 1): void => {
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

  // 基础涂装：浅灰白防热漆 + 轻微纵向喷涂色差
  paintBand(MISSILE_NOSE_Z, MISSILE_TAIL_Z, '#e9ebee');
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(168,176,184,0.10)' : 'rgba(255,255,255,0.09)';
    ctx.fillRect((i * 29) % width, 0, 6 + (i % 3) * 5, height);
  }

  // 各舱段色差：制导舱冷灰 / 发动机舱暖灰
  paintBand(1.24, 0.56, '#dde1e5');
  paintBand(-0.16, MISSILE_TAIL_Z, '#d4d6d8');

  // 黑色雷达罩 + 银色座环
  paintBand(MISSILE_NOSE_Z, 1.3, '#171b20');
  paintBand(1.3, 1.24, '#959ea7');

  // 滚转色带：黄色 ×2（实战战斗部）+ 棕色（实战发动机）
  paintBand(0.5, 0.42, '#e3bd2e');
  paintBand(0.36, 0.3, '#e3bd2e');
  paintBand(-0.3, -0.4, '#6e4a2f');

  // 舱段面板线
  paintSeam(0.93, '#596169');
  paintSeam(0.55, '#596169');
  paintSeam(-0.17, '#596169');
  paintSeam(-0.62, '#80878e');
  paintSeam(-0.78, '#80878e');

  // 检修口盖
  ctx.strokeStyle = 'rgba(70,78,86,0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(18, zToPx(0.86), 22, 24);
  ctx.strokeRect(74, zToPx(0.26), 18, 36);
  ctx.strokeRect(40, zToPx(-0.28), 26, 20);
  ctx.strokeRect(102, zToPx(0.08), 16, 28);

  // 模板印字（沿弹轴方向）
  stencil('AIM-120C', 12, 0.88, 'bold 11px monospace', '#3a4047');
  stencil('NO STEP', 60, 0.18, 'bold 9px monospace', '#4a5058');
  stencil('S/N 33174', 92, 0.88, '8px monospace', '#5a6068');
  stencil('ARM', 32, -0.46, 'bold 9px monospace', '#8a4a2f');

  // 细微污渍噪点
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(40,46,52,${(0.03 + Math.random() * 0.05).toFixed(3)})`;
    ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/**
 * 导弹模型共享几何体（全部预旋转为 +Z 朝前，全弹共用，常驻不释放）
 */
interface MissileGeometries {
  hull: THREE.LatheGeometry;
  wing: THREE.ExtrudeGeometry;
  tailFin: THREE.ExtrudeGeometry;
  nozzleCup: THREE.CylinderGeometry;
  nozzleRing: THREE.TorusGeometry;
  accentRing: THREE.CylinderGeometry;
  flameCore: THREE.ConeGeometry;
  flameMid: THREE.ConeGeometry;
  flameOuter: THREE.ConeGeometry;
}

let sharedMissileGeometries: MissileGeometries | null = null;

function getMissileGeometries(): MissileGeometries {
  if (!sharedMissileGeometries) {
    // 一体化车削弹体（含接缝凹槽与收口喷管，约 600 三角形）
    const hull = createHullGeometry(MISSILE_HULL_PROFILE, 18);
    // 中段切角三角翼（AIM-120 风格长弦薄翼，后掠前缘）
    const wing = createFinGeometry(
      [
        [0.3, 0],
        [-0.1, 0.27],
        [-0.26, 0.27],
        [-0.3, 0],
      ],
      0.024,
      0.006
    );
    // 尾部小型切角控制舵面
    const tailFin = createFinGeometry(
      [
        [0.16, 0],
        [-0.02, 0.2],
        [-0.13, 0.2],
        [-0.16, 0],
      ],
      0.02,
      0.005
    );
    // 凹陷喷管内衬 + 喷口炽热环
    const nozzleCup = new THREE.CylinderGeometry(0.082, 0.102, 0.16, 12, 1, true);
    nozzleCup.rotateX(Math.PI / 2);
    const nozzleRing = new THREE.TorusGeometry(0.112, 0.022, 6, 12);
    // 制导舱后的发光滚转标识环
    const accentRing = new THREE.CylinderGeometry(0.168, 0.168, 0.05, 18, 1, true);
    accentRing.rotateX(Math.PI / 2);
    // 三层尾焰：白热焰芯 / 橙色主焰 / 热霾外晕
    const flameCore = createFlameGeometry(0.055, 0.9, 8);
    const flameMid = createFlameGeometry(0.1, 1.35, 10);
    const flameOuter = createFlameGeometry(0.155, 2.0, 12);
    sharedMissileGeometries = {
      hull,
      wing,
      tailFin,
      nozzleCup,
      nozzleRing,
      accentRing,
      flameCore,
      flameMid,
      flameOuter,
    };
  }
  return sharedMissileGeometries;
}

/** 静态外观材质（不参与脉动动画，全弹共享，不随单发销毁） */
interface MissileStaticMaterials {
  body: THREE.MeshStandardMaterial;
  fin: THREE.MeshStandardMaterial;
  nozzleCup: THREE.MeshStandardMaterial;
}

let sharedMissileStaticMaterials: MissileStaticMaterials | null = null;

function getMissileStaticMaterials(): MissileStaticMaterials {
  if (!sharedMissileStaticMaterials) {
    const skin = getMissileBodySkin();
    sharedMissileStaticMaterials = {
      // 弹体：程序化涂装贴图承担分段涂装/色带/印字，材质保持浅色低金属度漆面
      body: new THREE.MeshStandardMaterial({
        color: skin ? 0xffffff : 0xdde1e5,
        map: skin,
        metalness: 0.45,
        roughness: 0.38,
        emissive: 0x10161c,
        emissiveIntensity: 0.32,
      }),
      // 翼面：亚光金属灰
      fin: new THREE.MeshStandardMaterial({
        color: 0xb9c0c7,
        metalness: 0.6,
        roughness: 0.45,
      }),
      // 喷管内衬：深色金属 + 余烬微光
      nozzleCup: new THREE.MeshStandardMaterial({
        color: 0x141417,
        metalness: 0.9,
        roughness: 0.4,
        emissive: 0x331106,
        emissiveIntensity: 0.6,
        side: THREE.DoubleSide,
      }),
    };
  }
  return sharedMissileStaticMaterials;
}

/** 逐发动画材质（脉动/闪烁动画会修改它们，每次装配新建，战斗实例随单发销毁） */
interface MissileAnimatedMaterials {
  accent: THREE.MeshStandardMaterial;
  nozzle: THREE.MeshStandardMaterial;
  flameOuter: THREE.MeshBasicMaterial;
  flameMid: THREE.MeshBasicMaterial;
  flameInner: THREE.MeshBasicMaterial;
  engineGlow: THREE.SpriteMaterial;
}

function createMissileAnimatedMaterials(): MissileAnimatedMaterials {
  return {
    accent: new THREE.MeshStandardMaterial({
      color: 0xff3a26,
      emissive: 0xff2200,
      emissiveIntensity: 0.85,
      metalness: 0.4,
      roughness: 0.4,
      side: THREE.DoubleSide,
    }),
    nozzle: new THREE.MeshStandardMaterial({
      color: 0x2c2f34,
      metalness: 0.95,
      roughness: 0.3,
      emissive: 0xff5a22,
      emissiveIntensity: 0.4,
    }),
    flameOuter: new THREE.MeshBasicMaterial({
      color: 0xff6a14,
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    flameMid: new THREE.MeshBasicMaterial({
      color: 0xff9a2e,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    flameInner: new THREE.MeshBasicMaterial({
      color: 0xfff6dd,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    engineGlow: new THREE.SpriteMaterial({
      map: getVfxTextures().glow,
      color: 0xffb763,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  };
}

/** 装配产物中需要逐帧动画的节点 */
interface MissileModelParts {
  flameOuter: THREE.Mesh;
  flameMid: THREE.Mesh;
  flameInner: THREE.Mesh;
  engineGlow: THREE.Sprite;
}

/**
 * 装配导弹模型（AIM-120 风格，+Z 朝前），战斗实例与预览工厂共用：
 * 一体化车削弹体（黑雷达罩/制导舱/战斗部/发动机舱涂装在共享画布贴图上）
 * + X 布局切角三角翼与尾部控制舵面 + 凹陷喷管 + 发光滚转环
 * + 三层尾焰（白热焰芯/橙色主焰/热霾外晕）+ 引擎光晕。
 * 所有节点都引用模块级共享几何体/静态材质/贴图，统一标记
 * userData.sharedResource，预览画廊销毁时会跳过这些共享资源。
 */
function assembleMissileModel(
  group: THREE.Group,
  materials: MissileAnimatedMaterials
): MissileModelParts {
  const geometries = getMissileGeometries();
  const staticMaterials = getMissileStaticMaterials();
  const add = (object: THREE.Object3D): void => {
    object.userData.sharedResource = true;
    group.add(object);
  };

  // 一体化车削弹体（分段涂装见共享贴图）
  add(new THREE.Mesh(geometries.hull, staticMaterials.body));

  // 凹陷喷管内衬 + 喷口炽热环
  const nozzleCup = new THREE.Mesh(geometries.nozzleCup, staticMaterials.nozzleCup);
  nozzleCup.position.z = -0.94;
  add(nozzleCup);

  const nozzleRing = new THREE.Mesh(geometries.nozzleRing, materials.nozzle);
  nozzleRing.position.z = -1.0;
  add(nozzleRing);

  // 制导舱后的发光滚转标识环
  const accentRing = new THREE.Mesh(geometries.accentRing, materials.accent);
  accentRing.position.z = 0.88;
  add(accentRing);

  // X 布局：中段切角三角翼 + 尾部小型控制舵面
  const finRootOffset = 0.15;
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;

    const wing = new THREE.Mesh(geometries.wing, staticMaterials.fin);
    wing.position.set(Math.cos(angle) * finRootOffset, Math.sin(angle) * finRootOffset, 0.1);
    wing.rotation.z = angle - Math.PI / 2;
    add(wing);

    const tailFin = new THREE.Mesh(geometries.tailFin, staticMaterials.fin);
    tailFin.position.set(Math.cos(angle) * finRootOffset, Math.sin(angle) * finRootOffset, -0.74);
    tailFin.rotation.z = angle - Math.PI / 2;
    add(tailFin);
  }

  // 三层尾焰：焰口锚定在喷管处，长度随速度/脉动伸缩
  const flameInner = new THREE.Mesh(geometries.flameCore, materials.flameInner);
  flameInner.position.z = -0.94;
  add(flameInner);

  const flameMid = new THREE.Mesh(geometries.flameMid, materials.flameMid);
  flameMid.position.z = -1.0;
  add(flameMid);

  const flameOuter = new THREE.Mesh(geometries.flameOuter, materials.flameOuter);
  flameOuter.position.z = -1.02;
  add(flameOuter);

  const engineGlow = new THREE.Sprite(materials.engineGlow);
  engineGlow.scale.set(1.1, 1.1, 1);
  engineGlow.position.z = -1.12;
  add(engineGlow);

  return { flameOuter, flameMid, flameInner, engineGlow };
}

/**
 * 预览工厂：仅装配玩家导弹视觉模型（不需要场景/粒子系统/目标）。
 * 动画材质为全新实例，模型画廊不会改动战斗弹使用的材质。
 */
export function createMissileVisualMesh(): THREE.Group {
  const group = new THREE.Group();
  assembleMissileModel(group, createMissileAnimatedMaterials());
  return group;
}

/**
 * 导弹类
 */
export class Missile {
  public mesh: THREE.Group;
  public velocity: THREE.Vector3;
  public target: THREE.Object3D | null;
  public active: boolean = true;
  public lifetime: number = 0;
  public maxLifetime: number = GAME_CONSTANTS.MISSILE.MAX_LIFETIME; // 超过寿命后自毁

  private turnSpeed: number = GAME_CONSTANTS.MISSILE.TURN_SPEED; // 转向速度（弧度/秒）
  /** 巡航速度：不低于 SPEED，也不低于发射瞬间的载机速度 + MIN_OVERTAKE_SPEED */
  private cruiseSpeed: number = GAME_CONSTANTS.MISSILE.SPEED;
  /** 当前速率：离架时为载机速度 + LAUNCH_SPEED_BOOST，按 ACCELERATION 加速到巡航速度 */
  private currentSpeed: number = GAME_CONSTANTS.MISSILE.SPEED;
  /** 飞行方向（单位向量）；velocity = heading × currentSpeed */
  private readonly heading = new THREE.Vector3(0, 0, -1);
  /** 本步移动前的位置：命中判定按这一步扫过的线段算，高速时不会从目标身上跳过去 */
  private readonly previousPosition = new THREE.Vector3();
  private particleSystem: ParticleSystem;
  private startPosition: THREE.Vector3; // 记录发射位置
  private maxFlightDistance: number = GAME_CONSTANTS.MISSILE.MAX_FLIGHT_DISTANCE; // 最大飞行距离
  private enemies: THREE.Object3D[] = []; // 敌人列表，用于重新锁定目标
  private readonly ownedMaterials: THREE.Material[] = [];
  private accentMaterial!: THREE.MeshStandardMaterial;
  private nozzleMaterial!: THREE.MeshStandardMaterial;
  private flameOuterMaterial!: THREE.MeshBasicMaterial;
  private flameMidMaterial!: THREE.MeshBasicMaterial;
  private flameInnerMaterial!: THREE.MeshBasicMaterial;
  private engineGlowMaterial!: THREE.SpriteMaterial;
  private flameOuter!: THREE.Mesh;
  private flameMid!: THREE.Mesh;
  private flameInner!: THREE.Mesh;
  private engineGlow!: THREE.Sprite;
  private trailTimer: number = MISSILE_TRAIL_INTERVAL;
  private visualPulseTime: number = 0;
  private readonly targetWorldPos = new THREE.Vector3();
  private readonly targetDirection = new THREE.Vector3();
  /** 目标上一步的位置与由此估算的速度（前置量用）；换目标 / 丢目标时作废 */
  private readonly targetLastPos = new THREE.Vector3();
  private readonly targetVelocity = new THREE.Vector3();
  private sampledTarget: THREE.Object3D | null = null;
  private readonly steerLateral = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private readonly orientationHelper = new THREE.Object3D();
  private readonly trailPosition = new THREE.Vector3();
  private readonly backwardDirection = new THREE.Vector3();
  private readonly trailColor = new THREE.Color();
  private readonly enemyWorldPos = new THREE.Vector3();

  /**
   * @param direction 发射方向（载机机头方向）。导弹先沿它直飞 MISSILE_BOOST_TIME 秒再开始制导；
   *                  方向非法（零向量 / 非有限数）时退回旧行为：直接指向目标，没有目标则朝 -Z。
   * @param launcherSpeed 发射瞬间载机沿机头方向的速度（米/秒）。导弹继承它，再加上
   *                  LAUNCH_SPEED_BOOST 作为离架初速，之后按 ACCELERATION 加速到巡航速度。
   */
  constructor(
    scene: THREE.Scene,
    position: THREE.Vector3,
    direction: THREE.Vector3,
    target: THREE.Object3D | null,
    particleSystem: ParticleSystem,
    enemies: THREE.Object3D[] = [],
    launcherSpeed: number = 0
  ) {
    this.particleSystem = particleSystem;
    this.target = target;
    this.enemies = enemies;

    // 记录发射位置
    this.startPosition = position.clone();
    this.previousPosition.copy(position);

    // 导弹模型 - 使用父容器来正确控制朝向（+Z 朝前）
    this.mesh = new THREE.Group();
    this.buildMissileModel();

    // 设置导弹位置为发射位置
    this.mesh.position.copy(position);

    scene.add(this.mesh);
    this.velocity = new THREE.Vector3();
    this.active = true;

    // 离架速度继承载机速度；巡航速度始终明显高于载机（加力 / 速度升级 / 加速道具之后也是）
    const inherited = Number.isFinite(launcherSpeed) ? Math.max(0, launcherSpeed) : 0;
    this.cruiseSpeed = Math.max(
      GAME_CONSTANTS.MISSILE.SPEED,
      inherited + GAME_CONSTANTS.MISSILE.MIN_OVERTAKE_SPEED
    );
    this.currentSpeed = Math.min(
      this.cruiseSpeed,
      inherited + GAME_CONSTANTS.MISSILE.LAUNCH_SPEED_BOOST
    );

    // 初始方向：沿发射方向离架；方向非法时指向目标
    const directionLength = direction.length();
    if (Number.isFinite(directionLength) && directionLength > 1e-4) {
      this.heading.copy(direction).multiplyScalar(1 / directionLength);
    } else if (this.target) {
      this.target.getWorldPosition(this.targetWorldPos);
      this.targetDirection.subVectors(this.targetWorldPos, position);
      const targetDistance = this.targetDirection.length();
      if (Number.isFinite(targetDistance) && targetDistance > 1e-4) {
        this.heading.copy(this.targetDirection).multiplyScalar(1 / targetDistance);
      }
    }
    this.velocity.copy(this.heading).multiplyScalar(this.currentSpeed);

    // 立即设置导弹朝向（与速度方向一致）
    if (this.velocity.length() > 0) {
      this.lookTarget.copy(this.mesh.position).add(this.velocity);
      this.mesh.lookAt(this.lookTarget);
    }
    // 尾焰从零渐入（见 updateVisuals）
    this.updateVisuals();
  }

  /**
   * 构建导弹模型：装配逻辑与预览工厂共用（见 assembleMissileModel），
   * 战斗实例持有动画材质引用以驱动脉动/闪烁，并随单发销毁。
   */
  private buildMissileModel(): void {
    const materials = createMissileAnimatedMaterials();
    this.accentMaterial = materials.accent;
    this.nozzleMaterial = materials.nozzle;
    this.flameOuterMaterial = materials.flameOuter;
    this.flameMidMaterial = materials.flameMid;
    this.flameInnerMaterial = materials.flameInner;
    this.engineGlowMaterial = materials.engineGlow;
    this.ownedMaterials.push(
      materials.accent,
      materials.nozzle,
      materials.flameOuter,
      materials.flameMid,
      materials.flameInner,
      materials.engineGlow
    );

    const parts = assembleMissileModel(this.mesh, materials);
    this.flameOuter = parts.flameOuter;
    this.flameMid = parts.flameMid;
    this.flameInner = parts.flameInner;
    this.engineGlow = parts.engineGlow;
  }

  /**
   * 更新导弹
   */
  public update(deltaTime: number): void {
    this.lifetime += deltaTime;
    this.previousPosition.copy(this.mesh.position);

    // 检查飞行距离（超过最大飞行距离则自毁）
    const flightDistance = this.mesh.position.distanceTo(this.startPosition);
    if (flightDistance > this.maxFlightDistance) {
      // 超过最大飞行距离，导弹自毁
      this.active = false;
      return;
    }

    // 超过最大寿命则销毁
    if (this.lifetime > this.maxLifetime) {
      // 导弹即将消失，创建明显的尾气效果
      if (this.target && this.target.parent) {
        // 生成导弹尾气（使用橙红色）
        this.trailColor.set(0xff6600);
        this.particleSystem.createTrail(this.mesh.position, this.trailColor);
      }

      this.active = false;
      return;
    }

    // 如果目标被摧毁，尝试寻找新目标
    if (!this.target || (this.target && !this.target.parent)) {
      // 尝试重新锁定目标
      const newTarget = this.findNearestEnemy();
      if (newTarget) {
        this.target = newTarget;
        log.debug('Missile re-acquired a target');
      }
    }

    // 离架后一路加速到巡航速度
    this.currentSpeed = Math.min(
      this.cruiseSpeed,
      this.currentSpeed + GAME_CONSTANTS.MISSILE.ACCELERATION * deltaTime
    );

    // 如果有目标，追踪目标（离架后的直飞段只记录目标运动、不制导）
    if (this.target && this.target.parent) {
      const tracked = this.sampleTarget(deltaTime);
      if (tracked && this.lifetime >= MISSILE_BOOST_TIME) {
        this.huntTarget(deltaTime);
      }
    } else {
      this.sampledTarget = null;
    }

    // 移动导弹
    this.velocity.copy(this.heading).multiplyScalar(this.currentSpeed);
    this.mesh.position.addScaledVector(this.velocity, deltaTime);
    this.visualPulseTime += deltaTime;
    this.updateVisuals();

    // 更新朝向（使用四元数直接指向速度方向）
    if (this.velocity.length() > 0) {
      this.lookTarget.copy(this.mesh.position).add(this.velocity);
      this.orientationHelper.position.copy(this.mesh.position);
      this.orientationHelper.lookAt(this.lookTarget);

      // 平滑插值到目标朝向（避免突然转向）
      this.mesh.quaternion.slerp(this.orientationHelper.quaternion, 0.3);
    }

    // 按固定步进发射尾焰，避免每帧都创建粒子
    if (this.active) {
      this.trailTimer += deltaTime;
      while (this.trailTimer >= MISSILE_TRAIL_INTERVAL) {
        this.trailTimer -= MISSILE_TRAIL_INTERVAL;
        this.emitTrail();
      }
    }
  }

  /**
   * 读取目标的世界坐标（写入 targetWorldPos），并用与上一步的位置差估算目标速度。
   * 坐标非法时返回 false（本步不制导）。换目标后的第一步、以及估算速度大得不合理
   * （目标被瞬移 / 回收复用）时，速度按零处理。
   */
  private sampleTarget(deltaTime: number): boolean {
    const target = this.target;
    if (!target) return false;

    // 使用 getWorldPosition 获取实时世界坐标（解决 Boss 部件位置不更新的问题）
    const position = this.targetWorldPos;
    target.getWorldPosition(position);
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z)) {
      this.sampledTarget = null;
      return false;
    }

    const velocity = this.targetVelocity;
    if (this.sampledTarget === target && deltaTime > 1e-4) {
      velocity.subVectors(position, this.targetLastPos).multiplyScalar(1 / deltaTime);
      if (!(velocity.lengthSq() <= MISSILE_TARGET_SPEED_LIMIT * MISSILE_TARGET_SPEED_LIMIT)) {
        velocity.set(0, 0, 0);
      }
    } else {
      velocity.set(0, 0, 0);
    }
    this.targetLastPos.copy(position);
    this.sampledTarget = target;
    return true;
  }

  /**
   * 追踪目标：三维前置追踪，飞行方向每步至多转动 turnSpeed × deltaTime。
   * - 瞄准点 = 目标位置 + 目标速度 × 预计飞行时间（距离 / 巡航速度），对横向飞行的目标
   *   走拦截航线而不是尾追。
   * - 瞄准点落在自己的转弯圆以内（贴脸发射 / 掠过目标之后）时，转向速度抬高到
   *   “沿一段圆弧正好飞到瞄准点”所需的值（2 × 速度 × sin(偏角) / 距离），
   *   导弹不会绕着目标打转。
   */
  private huntTarget(deltaTime: number): void {
    const heading = this.heading;
    const aim = this.targetDirection;

    // 到目标的距离 → 预计飞行时间 → 前置瞄准点
    aim.subVectors(this.targetWorldPos, this.mesh.position);
    const range = aim.length();
    const leadTime = range / this.cruiseSpeed;
    aim.addScaledVector(this.targetVelocity, leadTime);
    const aimDistance = aim.length();
    if (!Number.isFinite(aimDistance) || aimDistance < 1e-4) {
      return;
    }
    aim.multiplyScalar(1 / aimDistance);

    const cos = THREE.MathUtils.clamp(heading.dot(aim), -1, 1);
    // heading 之外、指向瞄准点一侧的分量；长度即 sin(偏角)
    const lateral = this.steerLateral.copy(aim).addScaledVector(heading, -cos);
    let sin = lateral.length();
    if (sin < 1e-5) {
      if (cos > 0) {
        // 已经对准
        return;
      }
      // 瞄准点在正后方：水平掉头（飞行方向竖直时任取一个水平方向）
      lateral.set(-heading.z, 0, heading.x);
      if (lateral.lengthSq() < 1e-8) lateral.set(1, 0, 0);
      lateral.normalize();
      sin = 1;
    } else {
      lateral.multiplyScalar(1 / sin);
    }

    const arcTurnSpeed = (2 * this.currentSpeed * (cos >= 0 ? sin : 1)) / aimDistance;
    const maxAngle = Math.max(this.turnSpeed, arcTurnSpeed) * deltaTime;
    const angle = Math.acos(cos);
    if (!(maxAngle > 0)) {
      return;
    }
    if (angle <= maxAngle) {
      heading.copy(aim);
      return;
    }
    heading
      .multiplyScalar(Math.cos(maxAngle))
      .addScaledVector(lateral, Math.sin(maxAngle))
      .normalize();
  }

  /**
   * 本步扫过的线段（移动前 → 当前位置）上离 point 最近的点写入 out，返回两者的距离。
   * 巡航时一步要飞好几米，只比较当前位置会从小目标身上跳过去。
   */
  public closestApproach(point: THREE.Vector3, out: THREE.Vector3): number {
    const from = this.previousPosition;
    out.subVectors(this.mesh.position, from);
    const lengthSq = out.lengthSq();
    let t = 1;
    if (lengthSq > 1e-8) {
      t = THREE.MathUtils.clamp(
        ((point.x - from.x) * out.x + (point.y - from.y) * out.y + (point.z - from.z) * out.z) /
          lengthSq,
        0,
        1
      );
    }
    out.multiplyScalar(t).add(from);
    return out.distanceTo(point);
  }

  private emitTrail(): void {
    // 离架后先不出烟，再渐入：发射点附近不留一团挡住目标的烟
    const ramp = THREE.MathUtils.clamp(
      (this.lifetime - MISSILE_TRAIL_DELAY) / MISSILE_TRAIL_RAMP_TIME,
      0,
      1
    );
    if (ramp <= 0) {
      return;
    }

    this.trailPosition.copy(this.mesh.position);
    this.backwardDirection.copy(this.velocity).normalize().multiplyScalar(-1.5);
    this.trailPosition.add(this.backwardDirection);
    this.trailColor.setHSL(0.08 + Math.random() * 0.03, 1, 0.6);
    // 玩家导弹用更轻的尾迹配方（见 trailRecipes），只作用于下面这一次调用
    beginPlayerMissileTrail(ramp);
    try {
      this.particleSystem.createMissileTrail(
        this.trailPosition,
        this.velocity,
        this.trailColor,
        MISSILE_TRAIL_VISIBILITY_INTENSITY
      );
    } finally {
      endPlayerMissileTrail();
    }
  }

  private updateVisuals(): void {
    const t = this.visualPulseTime;
    // 双频叠加的高频火焰闪烁（0..1 左右波动）
    const flicker = 0.5 + 0.28 * Math.sin(t * 52) + 0.22 * Math.sin(t * 87 + 1.7);
    const flickerB = 0.5 + 0.5 * Math.sin(t * 64 + 0.9);
    // 尾焰长度随速度变化：离架时最短，加速到巡航速度时达到正常长度
    const speedPulse = THREE.MathUtils.clamp(this.currentSpeed / this.cruiseSpeed, 0.8, 1.15);
    // 离架渐入：0.05 秒前完全不可见，0.35 秒时达到正常亮度
    const launchFade = THREE.MathUtils.smoothstep(
      this.lifetime,
      MISSILE_FLAME_FADE_START,
      MISSILE_FLAME_FADE_END
    );
    const flamesVisible = launchFade > 0.001;
    this.flameOuter.visible = flamesVisible;
    this.flameMid.visible = flamesVisible;
    this.flameInner.visible = flamesVisible;
    this.engineGlow.visible = flamesVisible;

    this.accentMaterial.emissiveIntensity = 0.55 + flicker * 0.5;
    this.nozzleMaterial.emissiveIntensity = 0.3 + flicker * 0.45;

    // 三层尾焰：焰口锚定喷管，焰长随速度脉动伸缩，径向随闪烁抖动
    this.flameOuterMaterial.opacity = (0.16 + flicker * 0.16) * launchFade;
    const outerScale = 0.85 + flicker * 0.3;
    this.flameOuter.scale.set(outerScale, outerScale, (0.8 + flicker * 0.45) * speedPulse);

    this.flameMidMaterial.opacity = (0.5 + flicker * 0.35) * launchFade;
    const midScale = 0.85 + flicker * 0.3;
    this.flameMid.scale.set(midScale, midScale, (0.82 + flicker * 0.42) * speedPulse);

    this.flameInnerMaterial.opacity = (0.72 + flickerB * 0.28) * launchFade;
    const innerScale = 0.88 + flickerB * 0.3;
    this.flameInner.scale.set(innerScale, innerScale, (0.85 + flickerB * 0.45) * speedPulse);

    this.engineGlowMaterial.opacity = (0.5 + flicker * 0.4) * launchFade;
    const glowScale = 0.9 + flicker * 0.5;
    this.engineGlow.scale.set(glowScale, glowScale, 1);
  }

  /**
   * 寻找最近的敌人
   */
  private findNearestEnemy(): THREE.Object3D | null {
    let nearestEnemy: THREE.Object3D | null = null;
    let nearestDistance = Infinity;

    for (const enemy of this.enemies) {
      if (!enemy.parent) continue;

      enemy.getWorldPosition(this.enemyWorldPos);
      const distance = this.mesh.position.distanceTo(this.enemyWorldPos);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestEnemy = enemy;
      }
    }

    return nearestEnemy;
  }

  /**
   * 设置目标
   */
  public setTarget(target: THREE.Object3D): void {
    this.target = target;
  }

  /**
   * 更新敌人列表（用于导弹自动锁定）
   */
  public updateEnemies(enemies: THREE.Object3D[]): void {
    this.enemies = enemies;
  }

  /**
   * 清除导弹
   */
  public dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    for (const material of this.ownedMaterials) {
      material.dispose();
    }
    this.ownedMaterials.length = 0;
    this.active = false;
  }
}

/**
 * 导弹系统管理器
 */
export class MissileSystem {
  private scene: THREE.Scene;
  private particleSystem: ParticleSystem;
  private missiles: Missile[] = [];
  private readonly collisionTargetPosition = new THREE.Vector3();
  private readonly collisionClosestPoint = new THREE.Vector3();
  private enemies: THREE.Object3D[] = []; // 存储敌人列表，用于重新锁定
  /** 预热用的隐形导弹模型及其材质（材质一直保留，着色器程序才不会被渲染器回收） */
  private warmModel: THREE.Group | null = null;
  private readonly warmMaterials: THREE.Material[] = [];
  private warmDraws = 0;

  constructor(scene: THREE.Scene, particleSystem?: ParticleSystem) {
    this.scene = scene;
    // 如果没有传入 particleSystem，创建一个临时的
    this.particleSystem = particleSystem || new ParticleSystem(scene);
  }

  /**
   * 更新敌人列表（用于导弹自动锁定）
   */
  public updateEnemies(enemies: THREE.Object3D[]): void {
    this.enemies = enemies;
    // 更新所有现有导弹的敌人列表
    for (const missile of this.missiles) {
      missile.updateEnemies(enemies);
    }
  }

  /**
   * 发射导弹：从 position 沿 direction 离架，直飞一小段后追踪 target。
   * launcherSpeed 为发射瞬间载机沿 direction 的速度（米/秒），导弹继承它并继续加速（见 Missile）。
   */
  public fire(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    target?: THREE.Object3D,
    launcherSpeed: number = 0
  ): void {
    const missile = new Missile(
      this.scene,
      position,
      direction,
      target || null,
      this.particleSystem,
      this.enemies,
      launcherSpeed
    );
    this.missiles.push(missile);
  }

  /**
   * 预热（关卡加载时调用，可重复调用）：把一枚缩到看不见、放在地表以下的导弹模型留在场景里
   * 渲染几帧，让渲染器提前编译导弹用到的着色器、上传几何体与涂装贴图，
   * 这些工作原本都压在第一次发射的那一帧。之后模型撤下，材质保留到 dispose。
   */
  public prewarm(): void {
    if (!this.warmModel) {
      const group = new THREE.Group();
      const materials = createMissileAnimatedMaterials();
      assembleMissileModel(group, materials);
      this.warmMaterials.push(
        materials.accent,
        materials.nozzle,
        materials.flameOuter,
        materials.flameMid,
        materials.flameInner,
        materials.engineGlow
      );
      for (const node of group.children) {
        // 不做视锥剔除：无论相机朝向都会真正提交绘制
        node.frustumCulled = false;
      }
      const probe = group.children[0];
      probe.onBeforeRender = () => {
        this.warmDraws++;
      };
      group.scale.setScalar(0.001);
      group.position.set(0, -4000, 0);
      this.warmModel = group;
    }
    this.warmDraws = 0;
    if (!this.warmModel.parent) {
      this.scene.add(this.warmModel);
    }
  }

  /**
   * 更新所有导弹
   */
  public update(deltaTime: number): void {
    if (this.warmModel?.parent && this.warmDraws >= MISSILE_WARM_DRAWS) {
      this.scene.remove(this.warmModel);
    }

    const missiles = this.missiles;
    // 更新所有导弹
    for (let i = 0; i < missiles.length; i++) {
      const missile = missiles[i];
      if (missile.active) {
        missile.update(deltaTime);
      }
    }

    // 原地移除不活跃的导弹（稳定压缩：保持发射顺序，逐帧不分配新数组）
    let kept = 0;
    for (let i = 0; i < missiles.length; i++) {
      const missile = missiles[i];
      if (!missile.active) {
        missile.dispose(this.scene);
        continue;
      }
      if (kept !== i) {
        missiles[kept] = missile;
      }
      kept++;
    }
    missiles.length = kept;
  }

  public checkCollisions(
    targetMeshes: THREE.Object3D[],
    onHit: (target: THREE.Object3D, impactPosition: THREE.Vector3) => void
  ): void {
    const targetWorldPos = this.collisionTargetPosition;
    for (const missile of this.missiles) {
      if (!missile.active) continue;

      for (const targetMesh of targetMeshes) {
        targetMesh.getWorldPosition(targetWorldPos);

        if (
          !isFinite(targetWorldPos.x) ||
          !isFinite(targetWorldPos.y) ||
          !isFinite(targetWorldPos.z)
        ) {
          continue;
        }

        // 按本步扫过的线段取最近点，而不是只看当前位置
        const closest = this.collisionClosestPoint;
        const distance = missile.closestApproach(targetWorldPos, closest);
        // 大型目标（Boss 部件 / 舰船）按声明的命中半径判定；未声明的（普通敌机）用近炸距离
        const hitDistance = Math.max(2, getDeclaredHitRadius(targetMesh, MISSILE_PROXIMITY_RADIUS));

        if (distance < hitDistance) {
          missile.active = false;
          const impactPosition = closest.clone().lerp(targetWorldPos, 0.35);
          this.particleSystem.createMissileImpact(impactPosition, 1.55);
          onHit(targetMesh, impactPosition);
          break;
        }
      }
    }
  }

  /**
   * 获取活跃导弹数量
   */
  public getActiveCount(): number {
    // 逐帧调用（单位命中判定前的快速判断），计数而不是 filter 出新数组
    let count = 0;
    for (let i = 0; i < this.missiles.length; i++) {
      if (this.missiles[i].active) count++;
    }
    return count;
  }

  /**
   * 清除所有导弹
   */
  public dispose(): void {
    for (const missile of this.missiles) {
      missile.dispose(this.scene);
    }
    this.missiles = [];
    if (this.warmModel) {
      this.scene.remove(this.warmModel);
      this.warmModel = null;
    }
    for (const material of this.warmMaterials) {
      material.dispose();
    }
    this.warmMaterials.length = 0;
  }
}
