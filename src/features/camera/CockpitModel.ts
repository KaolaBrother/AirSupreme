import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  createCockpitDisplayTexture,
  DISPLAY_REGIONS,
  getRegionUv,
  remapPlaneUv,
} from './CockpitDisplays';
import type { DisplayRegion } from './CockpitDisplays';

/**
 * 第一人称驾驶舱（轻量）：遮光罩 + 仪表板（三块 MFD、UFC、两块圆表、告警灯）
 * + HUD 组合玻璃 + 风挡立柱 + 座舱沿/侧壁。
 *
 * 坐标系：content 以飞行员眼点为原点（机头 -Z、上 +Y、右 +X）。座舱结构在“座舱坐标系”中建模，
 * 整体绕眼点低头 4°（COCKPIT_PITCH）后烘焙到眼点坐标；HUD 组合玻璃直接放在眼点坐标里。
 * 所有几何距眼点 ≥ 0.4 m（相机 near = 0.1 时不会被近裁剪面切掉）。
 *
 * 视野（75° 竖直 FOV 下的实测值，中线仰角以视轴为 0°、向下为负）：
 * - 遮光罩是一道薄檐：可见上沿 -19.0°，唇口下沿约 -22°；其下依次是 UFC / 告警灯（约 -22°…-26°）
 *   与三块 MFD 的上半部（上沿约 -28°，屏幕下缘 -37.5° 处被裁掉一小截）。
 * - 座舱沿上表面在眼点下方 0.20 m，屏幕上从遮光罩两端向外下方斜出；风挡立柱截面 10 × 8 mm。
 * - 不透明部分约占屏幕 22%（16:9）/ 26%（4:3），上半屏遮挡 < 2%（4:3）。
 * - 组合玻璃 0.30 × 0.30 m，中心在视轴上、距眼点 0.6 m：通光范围水平 ±14.1°、竖直 +13.8° / -13.7°，
 *   框住 DOM 层的准星与导引头圆环；支杆与描边都在该范围之外。
 * 静态部件按材质合并为 7 个网格；动态部件（扫描线、地平线、油门条、指针、告警灯）单独驱动。
 */

type StaticBucket = 'glare' | 'panel' | 'frame' | 'bezel' | 'marking' | 'indicator' | 'screen';

interface ScreenSpec {
  region: DisplayRegion;
  u: number;
  v: number;
  width: number;
  height: number;
}

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const UNIT_SCALE = new THREE.Vector3(1, 1, 1);
const IDENTITY = new THREE.Quaternion();

/**
 * 座舱坐标系 → 眼点坐标系：整个座舱结构绕眼点低头（机头方向下沉），
 * 座舱纵向线条汇聚在准星下方，把视野让给前方。HUD 组合玻璃不随之转动（始终对准视轴）。
 */
const COCKPIT_PITCH = -THREE.MathUtils.degToRad(4);
const COCKPIT_FRAME = new THREE.Matrix4().makeRotationX(COCKPIT_PITCH);

/** 仪表板中心（座舱坐标）与后仰角：面板法线指向眼点 */
const PANEL_CENTER = new THREE.Vector3(0, -0.386, -0.655);
const PANEL_TILT = -0.21;
const PANEL_WIDTH = 0.76;
/** 面板沿板面的上下沿（v）：上沿收在遮光罩内，不再高出 UFC 一大截 */
const PANEL_TOP = 0.18;
const PANEL_BOTTOM = -0.26;
const PANEL_THICKNESS = 0.02;
/** 仪表板局部坐标 (u, v, n) → 眼点坐标 */
const PANEL_MATRIX = new THREE.Matrix4()
  .compose(PANEL_CENTER, new THREE.Quaternion().setFromAxisAngle(AXIS_X, PANEL_TILT), UNIT_SCALE)
  .premultiply(COCKPIT_FRAME);
/** 面板正面在面板局部坐标中的 n 值 */
const PANEL_FACE = PANEL_THICKNESS / 2;
const BEZEL_DEPTH = 0.012;
/** 屏幕略高于边框正面，避免深度冲突 */
const SCREEN_N = PANEL_FACE + BEZEL_DEPTH + 0.0006;
/** 动态符号再高出屏幕 1.5 mm */
const SYMBOL_N = SCREEN_N + 0.0015;

const MFD_SIDE = 0.13;
const MFD_CENTER = 0.15;
const SCREENS: Record<'radar' | 'attitude' | 'stores', ScreenSpec> = {
  radar: { region: DISPLAY_REGIONS.radar, u: -0.18, v: 0.025, width: MFD_SIDE, height: MFD_SIDE },
  attitude: {
    region: DISPLAY_REGIONS.attitude,
    u: 0,
    v: 0.015,
    width: MFD_CENTER,
    height: MFD_CENTER,
  },
  stores: { region: DISPLAY_REGIONS.stores, u: 0.18, v: 0.025, width: MFD_SIDE, height: MFD_SIDE },
};
const UFC: ScreenSpec = { region: DISPLAY_REGIONS.ufc, u: 0, v: 0.135, width: 0.17, height: 0.04 };
const GAUGES: ReadonlyArray<{ u: number; v: number }> = [
  { u: -0.312, v: 0.03 },
  { u: 0.312, v: 0.03 },
];
const GAUGE_RADIUS = 0.03;
const LAMPS: ReadonlyArray<{ u: number; v: number }> = [
  { u: -0.118, v: 0.135 },
  { u: 0.118, v: 0.135 },
];

/**
 * 遮光罩（座舱坐标）：薄檐，上表面向机头下倾，几乎与视线平行——从眼点看只是一道
 * 压在 UFC 上方的暗边，而不是一大片挡住前方的平台。
 */
const GLARE_HALF_WIDTH = 0.335;
/** 前缘 / 唇口中点到眼点的前向距离 */
const GLARE_FAR = 0.745;
const GLARE_LIP = 0.605;
/** 前缘上表面高度与上表面下倾角 */
const GLARE_FAR_TOP_Y = -0.2;
const GLARE_SLOPE = THREE.MathUtils.degToRad(11.5);
const GLARE_EXTRUDE = 0.016;
const GLARE_BEVEL = 0.005;

/** 座舱沿（舱盖导轨）上表面高度（座舱坐标）；侧壁、侧操纵台都以它为基准向下排布 */
const SILL_TOP_Y = -0.2;
/** 风挡立柱（+X 侧，座舱坐标）：细截面，根部落在座舱沿前端，向外上方伸出屏幕 */
const PILLAR_BASE: THREE.Vector3Tuple = [0.36, SILL_TOP_Y, -0.655];
const PILLAR_TOP: THREE.Vector3Tuple = [0.44, 0.46, -0.14];
const PILLAR_WIDTH = 0.01;
const PILLAR_DEPTH = 0.008;

/**
 * HUD 组合玻璃（眼点坐标，不随座舱低头）：上沿向眼点后仰 10°，中心略低于视轴以抵消后仰带来的
 * 上下不对称。通光范围约 ±14°，比 DOM 准星的导引头圆环（半径 = 视口短边的 13%：75° FOV 下
 * ≈ ±11.3°，速度 + 加力把 FOV 推到 82.65° 时 ≈ ±12.9°）略大。
 */
const COMBINER_CENTER = new THREE.Vector3(0, -0.006, -0.6);
const COMBINER_WIDTH = 0.3;
const COMBINER_HEIGHT = 0.3;
const COMBINER_TILT = THREE.MathUtils.degToRad(10);
/** 支杆：沿玻璃两侧边向下延伸到遮光罩，只托住玻璃下部，不进入中央瞄准区 */
const COMBINER_POST_WIDTH = 0.006;
const COMBINER_POST_BOTTOM = -0.236;
const COMBINER_POST_TOP = -0.07;

/** 指针：0 在左下（+135°），满量程在右下（-135°） */
const NEEDLE_ZERO = (3 * Math.PI) / 4;
const NEEDLE_SPAN = (3 * Math.PI) / 2;

const SYMBOL_GREEN = new THREE.Color(0x7dffb4);
const SYMBOL_AMBER = new THREE.Color(0xffb347);
const LAMP_AB_OFF = new THREE.Color(0.16, 0.08, 0.02);
const LAMP_AB_ON = new THREE.Color(1.0, 0.56, 0.12);
const LAMP_CAUTION_OFF = new THREE.Color(0.14, 0.11, 0.02);
const LAMP_CAUTION_ON = new THREE.Color(1.0, 0.8, 0.16);
const SCREEN_FALLBACK_COLOR = 0x0c2a1a;
const SCREEN_TEXTURED_TINT = 0.92;

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** 静态几何收集器：变换烘焙（到眼点坐标）后按材质桶合并 */
class StaticGeometryBuilder {
  private readonly buckets = new Map<StaticBucket, THREE.BufferGeometry[]>();
  private readonly localMatrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();

  /** 座舱坐标系中放置（随座舱低头）；eyeSpace = true 时直接按眼点坐标放置 */
  public add(
    bucket: StaticBucket,
    geometry: THREE.BufferGeometry,
    position: THREE.Vector3Tuple,
    quaternion: THREE.Quaternion = IDENTITY,
    eyeSpace: boolean = false
  ): void {
    this.localMatrix.compose(this.position.fromArray(position), quaternion, UNIT_SCALE);
    if (!eyeSpace) {
      this.localMatrix.premultiply(COCKPIT_FRAME);
    }
    this.push(bucket, geometry, this.localMatrix);
  }

  /** 仪表板局部坐标 (u 右, v 沿板面向上, n 指向眼点) 中放置 */
  public addOnPanel(
    bucket: StaticBucket,
    geometry: THREE.BufferGeometry,
    u: number,
    v: number,
    n: number,
    quaternion: THREE.Quaternion = IDENTITY
  ): void {
    this.localMatrix.compose(this.position.set(u, v, n), quaternion, UNIT_SCALE);
    this.localMatrix.premultiply(PANEL_MATRIX);
    this.push(bucket, geometry, this.localMatrix);
  }

  /** 沿两点之间放置细长盒（立柱、支杆）：盒子局部 Y 轴对准两点连线 */
  public addBeam(
    bucket: StaticBucket,
    from: THREE.Vector3Tuple,
    to: THREE.Vector3Tuple,
    width: number,
    depth: number,
    eyeSpace: boolean = false
  ): void {
    const start = new THREE.Vector3().fromArray(from);
    const end = new THREE.Vector3().fromArray(to);
    const direction = end.clone().sub(start);
    const length = direction.length();
    if (length < 1e-6) {
      return;
    }
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      AXIS_Y,
      direction.multiplyScalar(1 / length)
    );
    const middle = start.add(end).multiplyScalar(0.5);
    this.add(
      bucket,
      new THREE.BoxGeometry(width, length, depth),
      middle.toArray(),
      quaternion,
      eyeSpace
    );
  }

  public build(bucket: StaticBucket): THREE.BufferGeometry | null {
    const parts = this.buckets.get(bucket);
    if (!parts || parts.length === 0) {
      return null;
    }
    const merged = parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
    if (merged !== parts[0]) {
      parts.forEach((part) => part.dispose());
    }
    this.buckets.delete(bucket);
    if (!merged) {
      return null;
    }
    merged.computeBoundingSphere();
    return merged;
  }

  /** 释放尚未 build 的几何（构建失败时兜底） */
  public dispose(): void {
    this.buckets.forEach((parts) => parts.forEach((part) => part.dispose()));
    this.buckets.clear();
  }

  private push(bucket: StaticBucket, geometry: THREE.BufferGeometry, matrix: THREE.Matrix4): void {
    // 合并要求属性集一致：统一为非索引 + position/normal/uv
    const prepared = geometry.index ? geometry.toNonIndexed() : geometry;
    if (prepared !== geometry) {
      geometry.dispose();
    }
    for (const name of Object.keys(prepared.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') {
        prepared.deleteAttribute(name);
      }
    }
    prepared.clearGroups();
    prepared.applyMatrix4(matrix);
    let parts = this.buckets.get(bucket);
    if (!parts) {
      parts = [];
      this.buckets.set(bucket, parts);
    }
    parts.push(prepared);
  }
}

/** 遮光罩平面形（俯视：x 向右、y 向前），后缘为弧形唇口；上表面绕前缘向机头下倾 */
function createGlareShieldGeometry(): THREE.BufferGeometry {
  const corner = GLARE_HALF_WIDTH - 0.023;
  const shape = new THREE.Shape();
  shape.moveTo(-GLARE_HALF_WIDTH, GLARE_FAR);
  shape.lineTo(GLARE_HALF_WIDTH, GLARE_FAR);
  shape.lineTo(GLARE_HALF_WIDTH, GLARE_LIP + 0.055);
  shape.lineTo(corner, GLARE_LIP + 0.03);
  // 二次曲线中点落在 GLARE_LIP
  shape.quadraticCurveTo(0, GLARE_LIP - 0.03, -corner, GLARE_LIP + 0.03);
  shape.lineTo(-GLARE_HALF_WIDTH, GLARE_LIP + 0.055);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: GLARE_EXTRUDE,
    bevelEnabled: true,
    bevelThickness: GLARE_BEVEL,
    bevelSize: GLARE_BEVEL,
    bevelSegments: 2,
    curveSegments: 18,
  });
  // 平面形 y（向前）→ -Z，拉伸方向 → +Y（厚度向上）
  geometry.rotateX(-Math.PI / 2);
  // 以前缘上棱为轴下倾：唇口（靠近眼点一侧）抬高
  geometry.translate(0, -(GLARE_EXTRUDE + GLARE_BEVEL), GLARE_FAR);
  geometry.rotateX(-GLARE_SLOPE);
  geometry.translate(0, GLARE_FAR_TOP_Y, -GLARE_FAR);
  return geometry;
}

/** 底边位于原点、沿 +Y 延伸的细长平面（指针/扫描线/油门条） */
function createBarGeometry(width: number, length: number): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(width, length);
  geometry.translate(0, length / 2, 0);
  return geometry;
}

export class CockpitModel {
  /** 跟随机体位姿（由 CameraRig 每帧写入位置/四元数） */
  public readonly root: THREE.Group;
  private readonly content: THREE.Group;
  private readonly panelSpace: THREE.Group;
  private readonly materials: THREE.Material[] = [];
  private readonly screenMaterial: THREE.MeshBasicMaterial;
  private readonly symbolMaterial: THREE.MeshBasicMaterial;
  private readonly throttleMaterial: THREE.MeshBasicMaterial;
  private readonly lampAbMaterial: THREE.MeshBasicMaterial;
  private readonly lampCautionMaterial: THREE.MeshBasicMaterial;
  private readonly sweepPivot = new THREE.Group();
  private readonly horizonPivot = new THREE.Group();
  private readonly horizonOffset = new THREE.Group();
  private readonly throttleBar: THREE.Mesh;
  private readonly needles: THREE.Mesh[] = [];
  private displayTexture: THREE.Texture | null = null;
  private displayTextureTried = false;
  private time = 0;
  private throttle = 0;
  private boost = 0;
  private disposed = false;
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();

  constructor(eyeOffset: THREE.Vector3) {
    this.root = new THREE.Group();
    this.root.name = 'cameraRigCockpit';
    this.root.visible = false;
    this.content = new THREE.Group();
    this.content.position.copy(eyeOffset);
    this.root.add(this.content);
    this.panelSpace = new THREE.Group();
    this.panelSpace.applyMatrix4(PANEL_MATRIX);
    this.content.add(this.panelSpace);

    const glare = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x111418,
        roughness: 0.95,
        metalness: 0.05,
        emissive: 0x040506,
      })
    );
    const panel = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x272c33,
        roughness: 0.82,
        metalness: 0.18,
        emissive: 0x06080a,
      })
    );
    const frame = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x343a42,
        roughness: 0.48,
        metalness: 0.62,
        emissive: 0x0c0e11,
      })
    );
    const bezel = this.track(
      new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.65, metalness: 0.3 })
    );
    const marking = this.track(new THREE.MeshBasicMaterial({ color: 0xc9d2da }));
    const indicator = this.track(new THREE.MeshBasicMaterial({ color: 0x46c27a }));
    this.screenMaterial = this.track(new THREE.MeshBasicMaterial({ color: SCREEN_FALLBACK_COLOR }));
    this.symbolMaterial = this.track(new THREE.MeshBasicMaterial({ color: SYMBOL_GREEN }));
    this.throttleMaterial = this.track(new THREE.MeshBasicMaterial({ color: SYMBOL_GREEN }));
    this.lampAbMaterial = this.track(new THREE.MeshBasicMaterial({ color: LAMP_AB_OFF }));
    this.lampCautionMaterial = this.track(new THREE.MeshBasicMaterial({ color: LAMP_CAUTION_OFF }));
    const needleMaterial = this.track(new THREE.MeshBasicMaterial({ color: 0xf4f7fa }));
    const glass = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x8ff0c8,
        transparent: true,
        opacity: 0.06,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    const glassEdge = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x9dffd0,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
      })
    );

    const builder = new StaticGeometryBuilder();
    try {
      this.buildStructure(builder);
      this.buildPanel(builder);
      const bucketMaterials: Array<[StaticBucket, THREE.Material]> = [
        ['glare', glare],
        ['panel', panel],
        ['frame', frame],
        ['bezel', bezel],
        ['marking', marking],
        ['indicator', indicator],
        ['screen', this.screenMaterial],
      ];
      for (const [bucket, material] of bucketMaterials) {
        const geometry = builder.build(bucket);
        if (!geometry) {
          continue;
        }
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `cockpit-${bucket}`;
        this.prepareStatic(mesh);
        this.content.add(mesh);
      }
    } finally {
      builder.dispose();
    }

    this.buildCombiner(glass, glassEdge);
    this.throttleBar = this.buildDynamicSymbols(needleMaterial);
  }

  public setVisible(visible: boolean): void {
    if (this.disposed) {
      return;
    }
    if (visible && !this.displayTextureTried) {
      this.displayTextureTried = true;
      this.displayTexture = createCockpitDisplayTexture();
      if (this.displayTexture) {
        this.screenMaterial.map = this.displayTexture;
        this.screenMaterial.color.setScalar(SCREEN_TEXTURED_TINT);
        this.screenMaterial.needsUpdate = true;
      }
    }
    this.root.visible = visible;
  }

  public isVisible(): boolean {
    return this.root.visible;
  }

  /**
   * 驱动仪表动画（仅可见时）：姿态仪随机体滚转/俯仰，雷达扫描，油门条与指针随速度/加力，
   * alert（0..1，通常为震动创伤）较大时主告警灯闪烁。
   */
  public update(
    deltaTime: number,
    aircraftQuaternion: THREE.Quaternion,
    speedRatio: number,
    boosting: boolean,
    alert: number
  ): void {
    if (this.disposed || !this.root.visible) {
      return;
    }
    const dt = Number.isFinite(deltaTime) && deltaTime > 0 ? Math.min(deltaTime, 0.1) : 0;
    this.time += dt;
    if (this.time > 3600) {
      this.time -= 3600;
    }
    const throttleTarget = Number.isFinite(speedRatio) ? clamp(speedRatio, 0, 1) : 0;
    this.throttle += (throttleTarget - this.throttle) * (1 - Math.exp(-dt * 5));
    const boostTarget = boosting ? 1 : 0;
    this.boost += (boostTarget - this.boost) * (1 - Math.exp(-dt * (boosting ? 10 : 4)));

    // 姿态：坡度 = atan2(-right.y, up.y)，俯仰 = asin(forward.y)
    this.right.set(1, 0, 0).applyQuaternion(aircraftQuaternion);
    this.up.set(0, 1, 0).applyQuaternion(aircraftQuaternion);
    this.forward.set(0, 0, -1).applyQuaternion(aircraftQuaternion);
    const bank = Math.atan2(-this.right.y, this.up.y);
    const pitch = Math.asin(clamp(this.forward.y, -1, 1));
    if (Number.isFinite(bank) && Number.isFinite(pitch)) {
      this.horizonPivot.rotation.z = bank;
      this.horizonOffset.position.y = clamp(-pitch * 0.09, -0.04, 0.04);
    }

    this.sweepPivot.rotation.z = Math.sin(this.time * 1.7) * 0.82;

    const thrust = clamp(0.1 + 0.75 * this.throttle + 0.15 * this.boost, 0, 1);
    this.throttleBar.scale.y = Math.max(0.02, thrust);
    this.throttleMaterial.color.copy(SYMBOL_GREEN).lerp(SYMBOL_AMBER, this.boost);

    const jitter = Math.sin(this.time * 23) * 0.006 + Math.sin(this.time * 41 + 1.1) * 0.004;
    const rpm = clamp(0.55 + 0.33 * this.throttle + 0.1 * this.boost + jitter, 0, 1);
    const temperature = clamp(0.46 + 0.22 * this.throttle + 0.24 * this.boost, 0, 1);
    this.needles[0].rotation.z = NEEDLE_ZERO - NEEDLE_SPAN * rpm;
    this.needles[1].rotation.z = NEEDLE_ZERO - NEEDLE_SPAN * temperature;

    const abGlow = this.boost * (0.88 + 0.12 * Math.sin(this.time * 31));
    this.lampAbMaterial.color.copy(LAMP_AB_OFF).lerp(LAMP_AB_ON, abGlow);
    const alertLevel = Number.isFinite(alert) ? alert : 0;
    const cautionOn = alertLevel > 0.35 && Math.sin(this.time * Math.PI * 6) > 0;
    this.lampCautionMaterial.color.copy(cautionOn ? LAMP_CAUTION_ON : LAMP_CAUTION_OFF);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.root.removeFromParent();
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
      }
    });
    this.materials.forEach((material) => material.dispose());
    this.materials.length = 0;
    this.displayTexture?.dispose();
    this.displayTexture = null;
    this.root.clear();
  }

  private track<T extends THREE.Material>(material: T): T {
    this.materials.push(material);
    return material;
  }

  private prepareStatic(mesh: THREE.Mesh): void {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
  }

  /** 遮光罩、HUD 组合玻璃支杆、风挡立柱、座舱沿、侧壁与侧操纵台 */
  private buildStructure(builder: StaticGeometryBuilder): void {
    builder.add('glare', createGlareShieldGeometry(), [0, 0, 0]);
    // 组合玻璃支杆（眼点坐标）：位于玻璃平面内、紧贴两侧边，根部插入遮光罩
    const postX = COMBINER_WIDTH / 2 + COMBINER_POST_WIDTH / 2;
    const glassZ = (y: number): number =>
      COMBINER_CENTER.z + (y - COMBINER_CENTER.y) * Math.tan(COMBINER_TILT);
    for (const side of [1, -1] as const) {
      builder.addBeam(
        'frame',
        [side * postX, COMBINER_POST_BOTTOM, glassZ(COMBINER_POST_BOTTOM)],
        [side * postX, COMBINER_POST_TOP, glassZ(COMBINER_POST_TOP)],
        COMBINER_POST_WIDTH,
        COMBINER_POST_WIDTH,
        true
      );
    }

    for (const side of [1, -1] as const) {
      // 风挡立柱：从座舱沿前端斜向外上方延伸到屏幕之外
      builder.addBeam(
        'frame',
        [side * PILLAR_BASE[0], PILLAR_BASE[1], PILLAR_BASE[2]],
        [side * PILLAR_TOP[0], PILLAR_TOP[1], PILLAR_TOP[2]],
        PILLAR_WIDTH,
        PILLAR_DEPTH
      );
      // 立柱根部整流块
      builder.add('frame', new THREE.BoxGeometry(0.04, 0.02, 0.05), [
        side * PILLAR_BASE[0],
        SILL_TOP_Y + 0.004,
        PILLAR_BASE[2],
      ]);
      // 座舱沿（舱盖导轨）
      builder.add('frame', new THREE.BoxGeometry(0.05, 0.034, 1.12), [
        side * 0.372,
        SILL_TOP_Y - 0.017,
        -0.1,
      ]);
      // 侧壁：填满视野下角；两条横向分缝 + 一道竖向加强筋打破大面积平面
      builder.add('panel', new THREE.BoxGeometry(0.012, 0.64, 1.25), [
        side * 0.392,
        SILL_TOP_Y - 0.339,
        -0.11,
      ]);
      for (const drop of [0.089, 0.179]) {
        builder.add('bezel', new THREE.BoxGeometry(0.006, 0.01, 1.0), [
          side * 0.384,
          SILL_TOP_Y - drop,
          -0.12,
        ]);
      }
      builder.add('frame', new THREE.BoxGeometry(0.008, 0.2, 0.022), [
        side * 0.383,
        SILL_TOP_Y - 0.139,
        -0.5,
      ]);
      // 侧操纵台 + 旋钮 + 指示灯
      const consoleY = SILL_TOP_Y - 0.259;
      builder.add('bezel', new THREE.BoxGeometry(0.16, 0.035, 0.9), [
        side * 0.305,
        consoleY,
        -0.08,
      ]);
      for (let i = 0; i < 4; i += 1) {
        builder.add('frame', new THREE.CylinderGeometry(0.011, 0.012, 0.018, 10), [
          side * (0.285 + (i % 2) * 0.04),
          consoleY + 0.026,
          -0.32 + i * 0.09,
        ]);
      }
      builder.add('marking', new THREE.BoxGeometry(0.05, 0.004, 0.012), [
        side * 0.3,
        consoleY + 0.019,
        0.08,
      ]);
      for (let i = 0; i < 3; i += 1) {
        builder.add('indicator', new THREE.BoxGeometry(0.014, 0.004, 0.009), [
          side * (0.33 - i * 0.022),
          consoleY + 0.019,
          -0.42,
        ]);
      }
    }
  }

  /** 仪表板：面板、MFD 边框与周边按键、屏幕、UFC、圆表、告警灯座 */
  private buildPanel(builder: StaticGeometryBuilder): void {
    builder.addOnPanel(
      'panel',
      new THREE.BoxGeometry(PANEL_WIDTH, PANEL_TOP - PANEL_BOTTOM, PANEL_THICKNESS),
      0,
      (PANEL_TOP + PANEL_BOTTOM) / 2,
      0
    );

    for (const screen of [SCREENS.radar, SCREENS.attitude, SCREENS.stores]) {
      const margin = 0.018;
      builder.addOnPanel(
        'bezel',
        new THREE.BoxGeometry(screen.width + margin * 2, screen.height + margin * 2, BEZEL_DEPTH),
        screen.u,
        screen.v,
        PANEL_FACE + BEZEL_DEPTH / 2
      );
      // 四周各 5 个功能按键（OSB）
      const buttonN = PANEL_FACE + BEZEL_DEPTH + 0.0025;
      const halfW = screen.width / 2 + margin / 2;
      const halfH = screen.height / 2 + margin / 2;
      for (let i = 0; i < 5; i += 1) {
        const t = (i - 2) / 2;
        const across = t * screen.width * 0.34;
        const along = t * screen.height * 0.34;
        builder.addOnPanel(
          'frame',
          new THREE.BoxGeometry(0.012, 0.007, 0.005),
          screen.u + across,
          screen.v + halfH,
          buttonN
        );
        builder.addOnPanel(
          'frame',
          new THREE.BoxGeometry(0.012, 0.007, 0.005),
          screen.u + across,
          screen.v - halfH,
          buttonN
        );
        builder.addOnPanel(
          'frame',
          new THREE.BoxGeometry(0.007, 0.012, 0.005),
          screen.u - halfW,
          screen.v + along,
          buttonN
        );
        builder.addOnPanel(
          'frame',
          new THREE.BoxGeometry(0.007, 0.012, 0.005),
          screen.u + halfW,
          screen.v + along,
          buttonN
        );
      }
      this.addScreen(builder, screen);
    }

    // UFC：窄边框 + 数字屏
    builder.addOnPanel(
      'bezel',
      new THREE.BoxGeometry(UFC.width + 0.02, UFC.height + 0.016, BEZEL_DEPTH),
      UFC.u,
      UFC.v,
      PANEL_FACE + BEZEL_DEPTH / 2
    );
    this.addScreen(builder, UFC);

    // 告警灯座
    for (const lamp of LAMPS) {
      builder.addOnPanel(
        'bezel',
        new THREE.BoxGeometry(0.046, 0.03, 0.006),
        lamp.u,
        lamp.v,
        PANEL_FACE + 0.003
      );
    }

    // 圆表：表盘 + 外圈 + 刻度
    for (const gauge of GAUGES) {
      builder.addOnPanel(
        'bezel',
        new THREE.CircleGeometry(GAUGE_RADIUS, 24),
        gauge.u,
        gauge.v,
        PANEL_FACE + 0.002
      );
      builder.addOnPanel(
        'frame',
        new THREE.TorusGeometry(GAUGE_RADIUS + 0.001, 0.0032, 6, 28),
        gauge.u,
        gauge.v,
        PANEL_FACE + 0.003
      );
      for (let i = 0; i <= 8; i += 1) {
        const angle = NEEDLE_ZERO - (NEEDLE_SPAN * i) / 8;
        const tickRadius = GAUGE_RADIUS * 0.8;
        builder.addOnPanel(
          'marking',
          new THREE.BoxGeometry(0.0016, i % 2 === 0 ? 0.008 : 0.005, 0.001),
          gauge.u - Math.sin(angle) * tickRadius,
          gauge.v + Math.cos(angle) * tickRadius,
          PANEL_FACE + 0.0026,
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle)
        );
      }
    }
  }

  private addScreen(builder: StaticGeometryBuilder, screen: ScreenSpec): void {
    const geometry = new THREE.PlaneGeometry(screen.width, screen.height);
    remapPlaneUv(geometry, getRegionUv(screen.region));
    builder.addOnPanel('screen', geometry, screen.u, screen.v, SCREEN_N);
  }

  /**
   * HUD 组合玻璃：对准视轴的后仰玻璃 + 上沿 / 两侧边微光（两根支杆已并入 frame 网格）。
   * 玻璃只是瞄准框：准星与导引头圆环由 DOM 层绘制，这里不画任何符号。
   */
  private buildCombiner(glass: THREE.Material, glassEdge: THREE.Material): void {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(COMBINER_WIDTH, COMBINER_HEIGHT), glass);
    pane.name = 'cockpit-combiner-glass';
    pane.position.copy(COMBINER_CENTER);
    pane.rotation.x = COMBINER_TILT;
    pane.renderOrder = 0;
    this.prepareStatic(pane);
    this.content.add(pane);

    // 微光描边（玻璃局部坐标）：上沿 + 支杆以上的两侧边
    const strip = 0.0016;
    const top = new THREE.BoxGeometry(COMBINER_WIDTH, strip, strip);
    top.translate(0, COMBINER_HEIGHT / 2, 0);
    const sideBottom = (COMBINER_POST_TOP - COMBINER_CENTER.y) / Math.cos(COMBINER_TILT);
    const sideLength = COMBINER_HEIGHT / 2 - sideBottom;
    const strips = [top];
    for (const side of [1, -1] as const) {
      const edgeStrip = new THREE.BoxGeometry(strip, sideLength, strip);
      edgeStrip.translate((side * COMBINER_WIDTH) / 2, sideBottom + sideLength / 2, 0);
      strips.push(edgeStrip);
    }
    const edgeGeometry = mergeGeometries(strips, false);
    strips.forEach((part) => part.dispose());
    const edge = new THREE.Mesh(edgeGeometry, glassEdge);
    edge.name = 'cockpit-combiner-edge';
    edge.position.copy(COMBINER_CENTER);
    edge.rotation.x = COMBINER_TILT;
    edge.renderOrder = 0;
    this.prepareStatic(edge);
    this.content.add(edge);
  }

  /** 动态符号：雷达扫描线、地平线 + 俯仰梯、油门条、两根指针、两盏告警灯 */
  private buildDynamicSymbols(needleMaterial: THREE.Material): THREE.Mesh {
    const radar = SCREENS.radar;
    const radarPixel = radar.width / radar.region.w;
    // B 显原点：画布中 (w/2, h-14) → 屏幕局部坐标
    this.sweepPivot.position.set(
      radar.u,
      radar.v + (radar.region.h / 2 - 154) * radarPixel,
      SYMBOL_N
    );
    const sweep = new THREE.Mesh(createBarGeometry(0.0018, 136 * radarPixel), this.symbolMaterial);
    sweep.name = 'cockpit-radar-sweep';
    this.sweepPivot.add(sweep);
    this.panelSpace.add(this.sweepPivot);

    const attitude = SCREENS.attitude;
    this.horizonPivot.position.set(attitude.u, attitude.v, SYMBOL_N);
    const horizon = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.0022), this.symbolMaterial);
    horizon.name = 'cockpit-horizon';
    this.horizonOffset.add(horizon);
    for (const offset of [0.028, -0.028]) {
      const ladder = new THREE.Mesh(new THREE.PlaneGeometry(0.044, 0.0015), this.symbolMaterial);
      ladder.position.y = offset;
      this.horizonOffset.add(ladder);
    }
    this.horizonPivot.add(this.horizonOffset);
    this.panelSpace.add(this.horizonPivot);

    // 油门条：对准右屏贴图中的外框（画布 x = w-34..w-16，y = 34..146）
    const stores = SCREENS.stores;
    const storesPixel = stores.width / stores.region.w;
    const bar = new THREE.Mesh(createBarGeometry(0.0115, 108 * storesPixel), this.throttleMaterial);
    bar.name = 'cockpit-throttle-bar';
    bar.position.set(
      stores.u + (stores.region.w - 25 - stores.region.w / 2) * storesPixel,
      stores.v + (stores.region.h / 2 - 144) * storesPixel,
      SYMBOL_N
    );
    this.panelSpace.add(bar);

    for (const gauge of GAUGES) {
      const needle = new THREE.Mesh(createBarGeometry(0.0028, GAUGE_RADIUS * 0.82), needleMaterial);
      needle.name = 'cockpit-gauge-needle';
      needle.position.set(gauge.u, gauge.v, PANEL_FACE + 0.0045);
      needle.rotation.z = NEEDLE_ZERO;
      this.panelSpace.add(needle);
      this.needles.push(needle);
      const hub = new THREE.Mesh(new THREE.CircleGeometry(0.004, 10), needleMaterial);
      hub.position.set(gauge.u, gauge.v, PANEL_FACE + 0.005);
      this.panelSpace.add(hub);
    }

    const lampMaterials = [this.lampAbMaterial, this.lampCautionMaterial];
    LAMPS.forEach((lamp, index) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.02, 0.005), lampMaterials[index]);
      mesh.name = index === 0 ? 'cockpit-lamp-ab' : 'cockpit-lamp-caution';
      mesh.position.set(lamp.u, lamp.v, PANEL_FACE + 0.0085);
      this.panelSpace.add(mesh);
    });

    this.panelSpace.traverse((object) => {
      object.castShadow = false;
      object.receiveShadow = false;
    });
    return bar;
  }
}
