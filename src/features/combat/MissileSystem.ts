import * as THREE from 'three';
import { ParticleSystem, getVfxTextures } from '@/features/effects/ParticleSystem';
import { GAME_CONSTANTS } from '@/config';
import { getLogger } from '@/core/utils/Logger';

const log = getLogger('MissileSystem');
// 稍微加密尾迹步进，让烟线更连续
const MISSILE_TRAIL_INTERVAL = 0.03;
// 海面和云层背景较亮，玩家导弹默认需要高于中性的尾迹强度
const MISSILE_TRAIL_VISIBILITY_INTENSITY = 1.25;

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
  public maxLifetime: number = 10; // 10秒后自毁

  private turnSpeed: number = GAME_CONSTANTS.MISSILE.TURN_SPEED; // 转向速度（弧度/秒）
  private speed: number = 80; // 导弹速度
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
  private readonly currentDirection = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private readonly orientationHelper = new THREE.Object3D();
  private readonly trailPosition = new THREE.Vector3();
  private readonly backwardDirection = new THREE.Vector3();
  private readonly trailColor = new THREE.Color();
  private readonly enemyWorldPos = new THREE.Vector3();

  constructor(
    scene: THREE.Scene,
    position: THREE.Vector3,
    target: THREE.Object3D | null,
    particleSystem: ParticleSystem,
    enemies: THREE.Object3D[] = []
  ) {
    this.particleSystem = particleSystem;
    this.target = target;
    this.enemies = enemies;

    // 记录发射位置
    this.startPosition = position.clone();

    // 导弹模型 - 使用父容器来正确控制朝向（+Z 朝前）
    this.mesh = new THREE.Group();
    this.buildMissileModel();

    // 设置导弹位置为发射位置
    this.mesh.position.copy(position);

    scene.add(this.mesh);
    this.velocity = new THREE.Vector3();
    this.active = true;

    // 设置初始速度朝向目标
    if (this.target) {
      this.target.getWorldPosition(this.targetWorldPos);
      this.targetDirection.subVectors(this.targetWorldPos, position).normalize();
      this.velocity.copy(this.targetDirection).multiplyScalar(this.speed);
    } else {
      this.velocity.set(0, 0, -this.speed);
    }

    // 立即设置导弹朝向（与速度方向一致）
    if (this.velocity.length() > 0) {
      this.lookTarget.copy(this.mesh.position).add(this.velocity);
      this.mesh.lookAt(this.lookTarget);
    }
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
        log.debug('导弹重新锁定目标');
      }
    }

    // 如果有目标，追踪目标
    if (this.target && this.target.parent) {
      this.huntTarget(deltaTime);
    }

    // 移动导弹
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
   * 追踪目标
   */
  private huntTarget(deltaTime: number): void {
    if (!this.target) return;

    // 使用 getWorldPosition 获取实时世界坐标（解决 Boss 部件位置不更新的问题）
    this.target.getWorldPosition(this.targetWorldPos);

    // 计算到目标的方向
    this.targetDirection.subVectors(this.targetWorldPos, this.mesh.position).normalize();

    // 获取当前速度方向
    this.currentDirection.copy(this.velocity).normalize();

    // 计算转向角度（限制转向速度）
    const turnAngle = this.turnSpeed * deltaTime;
    const targetRotation = Math.atan2(this.targetDirection.x, this.targetDirection.z);
    const currentRotation = Math.atan2(this.currentDirection.x, this.currentDirection.z);

    // 计算需要旋转的角度（选择最短路径）
    let rotationDiff = targetRotation - currentRotation;
    while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
    while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;

    // 限制转向速度
    rotationDiff = Math.max(-turnAngle, Math.min(turnAngle, rotationDiff));

    // 应用新的旋转
    const newRotation = currentRotation + rotationDiff;
    this.velocity.set(
      Math.sin(newRotation) * this.speed,
      this.targetDirection.y * this.speed, // 保留部分垂直方向
      Math.cos(newRotation) * this.speed
    );
  }

  private emitTrail(): void {
    this.trailPosition.copy(this.mesh.position);
    this.backwardDirection.copy(this.velocity).normalize().multiplyScalar(-1.5);
    this.trailPosition.add(this.backwardDirection);
    this.trailColor.setHSL(0.08 + Math.random() * 0.03, 1, 0.6);
    this.particleSystem.createMissileTrail(
      this.trailPosition,
      this.velocity,
      this.trailColor,
      MISSILE_TRAIL_VISIBILITY_INTENSITY
    );
  }

  private updateVisuals(): void {
    const t = this.visualPulseTime;
    // 双频叠加的高频火焰闪烁（0..1 左右波动）
    const flicker = 0.5 + 0.28 * Math.sin(t * 52) + 0.22 * Math.sin(t * 87 + 1.7);
    const flickerB = 0.5 + 0.5 * Math.sin(t * 64 + 0.9);
    const speedPulse = THREE.MathUtils.clamp(this.velocity.length() / this.speed, 0.8, 1.15);

    this.accentMaterial.emissiveIntensity = 0.55 + flicker * 0.5;
    this.nozzleMaterial.emissiveIntensity = 0.3 + flicker * 0.45;

    // 三层尾焰：焰口锚定喷管，焰长随速度脉动伸缩，径向随闪烁抖动
    this.flameOuterMaterial.opacity = 0.16 + flicker * 0.16;
    const outerScale = 0.85 + flicker * 0.3;
    this.flameOuter.scale.set(outerScale, outerScale, (0.8 + flicker * 0.45) * speedPulse);

    this.flameMidMaterial.opacity = 0.5 + flicker * 0.35;
    const midScale = 0.85 + flicker * 0.3;
    this.flameMid.scale.set(midScale, midScale, (0.82 + flicker * 0.42) * speedPulse);

    this.flameInnerMaterial.opacity = 0.72 + flickerB * 0.28;
    const innerScale = 0.88 + flickerB * 0.3;
    this.flameInner.scale.set(innerScale, innerScale, (0.85 + flickerB * 0.45) * speedPulse);

    this.engineGlowMaterial.opacity = 0.5 + flicker * 0.4;
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
  private enemies: THREE.Object3D[] = []; // 存储敌人列表，用于重新锁定

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
   * 发射导弹
   */
  public fire(position: THREE.Vector3, _direction: THREE.Vector3, target?: THREE.Object3D): void {
    const missile = new Missile(
      this.scene,
      position,
      target || null,
      this.particleSystem,
      this.enemies
    );
    this.missiles.push(missile);
  }

  /**
   * 更新所有导弹
   */
  public update(deltaTime: number): void {
    // 更新所有导弹
    for (const missile of this.missiles) {
      if (missile.active) {
        missile.update(deltaTime);
      }
    }

    // 移除不活跃的导弹
    this.missiles = this.missiles.filter((m) => {
      if (!m.active) {
        m.dispose(this.scene);
        return false;
      }
      return true;
    });
  }

  public checkCollisions(
    targetMeshes: THREE.Object3D[],
    onHit: (target: THREE.Object3D, impactPosition: THREE.Vector3) => void
  ): void {
    for (const missile of this.missiles) {
      if (!missile.active) continue;

      for (const targetMesh of targetMeshes) {
        const targetWorldPos = new THREE.Vector3();
        targetMesh.getWorldPosition(targetWorldPos);

        if (
          !isFinite(targetWorldPos.x) ||
          !isFinite(targetWorldPos.y) ||
          !isFinite(targetWorldPos.z)
        ) {
          continue;
        }

        const distance = missile.mesh.position.distanceTo(targetWorldPos);
        const hitDistance = 2;

        if (distance < hitDistance) {
          missile.active = false;
          const impactPosition = missile.mesh.position.clone().lerp(targetWorldPos, 0.35);
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
    return this.missiles.filter((m) => m.active).length;
  }

  /**
   * 清除所有导弹
   */
  public dispose(): void {
    for (const missile of this.missiles) {
      missile.dispose(this.scene);
    }
    this.missiles = [];
  }
}
