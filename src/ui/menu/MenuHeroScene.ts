import * as THREE from 'three';
import {
  createPlayerMesh,
  updateAircraftSignals,
  updatePlayerAfterburner,
} from '@/features/aircraft/AircraftMeshFactory';
import { disposeModelTree, releaseRenderer } from './modelDisposal';

/**
 * 标题画面的实时 3D 主机：玩家自己的战机（与对局同一个模型工厂）在云层上方缓缓压坡度飞行，
 * 翼尖拉出尾迹，云絮与气流线向后掠过，镜头缓慢环绕。
 *
 * 画布是透明的，叠在 CSS 天空（MenuBackdrop）之上，所以这里不画天空；场景很小：
 * 一架飞机、两条尾迹带、十几片云絮、一批流线，没有阴影和后处理。
 * 只持有一个 WebGL 上下文，dispose() 里连同几何体 / 材质 / 贴图 / 环境贴图一起交还。
 *
 * 本模块导入 three，必须通过 import() 按需加载（见 MenuHero）。
 */

export interface MenuHeroSceneOptions {
  /** 画布挂载点（铺满标题画面） */
  host: HTMLElement;
  maxPixelRatio: number;
  /** 减少动态效果：只画一帧静止画面，不启动渲染循环 */
  reducedMotion: boolean;
  /** 上下文意外丢失（系统回收）时通知控制器收场 */
  onContextLost: () => void;
}

interface Pose {
  roll: number;
  pitch: number;
  yaw: number;
  x: number;
  y: number;
  z: number;
}

interface Wisp {
  sprite: THREE.Sprite;
  speed: number;
  near: boolean;
}

const FOV = 30;
const FORWARD = new THREE.Vector3(0, 0, -1);
const UP = new THREE.Vector3(0, 1, 0);
const RIGHT = new THREE.Vector3(1, 0, 0);
/** 世界向后（+Z）流动的速度，单位 / 秒：尾迹、云絮、气流线都按它推进 */
const AIRSPEED = 34;
/** 太阳方向（世界空间，从飞机指向太阳）：机头前方偏左、贴近地平线，画面上落在右侧远处 */
const SUN_DIRECTION = new THREE.Vector3(-0.35, 0.2, -0.9).normalize();
/** 镜头环绕的基准方位（自机尾方向 +Z 朝右翼 +X 转）与俯仰，弧度 */
const ORBIT_AZIMUTH = 0.98;
const ORBIT_ELEVATION = 0.2;
const CAMERA_TARGET = new THREE.Vector3(0, 0.05, -0.15);

const TRAIL_POINTS = 26;
/** 尾迹回溯的时间跨度（秒）：长度 = AIRSPEED × 该值 */
const TRAIL_SECONDS = 0.5;
/** 机体上的航行灯 / 频闪灯 / 防撞灯（AircraftMeshFactory 里的命名） */
const SIGNAL_LIGHT_NAMES = ['navLightPort', 'navLightStarboard', 'strobeLight', 'beaconLight'];
/** 玩家机翼尖航行灯小球的半径上限（工厂里是 0.05） */
const WINGTIP_LIGHT_RADIUS = 0.06;
const WISP_COUNT = 13;
const WISP_FRONT_Z = -78;
const WISP_BACK_Z = 44;
const STREAK_COUNT = 30;
/** 减少动态效果时定格的时刻：压着坡度、镜头在侧后方的一帧 */
const STILL_TIME = 3.2;
/** 进入战场：加力推出画面的加速度（单位 / 秒²） */
const LAUNCH_ACCELERATION = 280;

/** 柔边圆形光斑贴图（引擎辉光） */
function createGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.22, 'rgba(255, 236, 200, 0.75)');
    gradient.addColorStop(0.55, 'rgba(255, 170, 90, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 140, 60, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 96, 96);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** 云絮贴图：几团叠在一起的柔边斑块 */
function createWispTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const blobs: ReadonlyArray<readonly [number, number, number, number]> = [
      [0.5, 0.52, 0.34, 0.9],
      [0.32, 0.55, 0.24, 0.7],
      [0.68, 0.5, 0.26, 0.7],
      [0.45, 0.42, 0.2, 0.6],
      [0.6, 0.6, 0.2, 0.55],
    ];
    for (const [x, y, radius, alpha] of blobs) {
      const gradient = ctx.createRadialGradient(
        x * size,
        y * size,
        0,
        x * size,
        y * size,
        radius * size
      );
      gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      gradient.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.45})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * 给金属机身反射用的天空：顶点着色的球，天顶深蓝、地平线暖色、下方是云海的蓝灰，
 * 太阳方向叠一团高亮。交给 PMREM 生成环境贴图后立即释放。
 */
function createEnvironmentScene(): { scene: THREE.Scene; dispose: () => void } {
  const geometry = new THREE.SphereGeometry(20, 32, 20);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const zenith = new THREE.Color(0x0a2a58);
  const sky = new THREE.Color(0x3f8fc4);
  const horizon = new THREE.Color(0xffc089);
  const deck = new THREE.Color(0x586c8e);
  const deep = new THREE.Color(0x0e1828);
  const sun = new THREE.Color(0xffd9a6);
  const color = new THREE.Color();
  const direction = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    direction.fromBufferAttribute(position, i).normalize();
    const y = direction.y;
    if (y >= 0) {
      const t = Math.pow(y, 0.55);
      color.copy(horizon).lerp(sky, Math.min(1, t * 2.2));
      color.lerp(zenith, Math.max(0, (t - 0.4) / 0.6));
    } else {
      color.copy(horizon).lerp(deck, Math.min(1, -y * 5));
      color.lerp(deep, Math.max(0, (-y - 0.25) / 0.75));
    }
    // 太阳：越靠近太阳方向越亮（超过 1 的高亮值由半浮点环境贴图保留）
    const facing = Math.max(0, direction.dot(SUN_DIRECTION));
    const glow = Math.pow(facing, 6) * 1.4 + Math.pow(facing, 60) * 9;
    color.r += sun.r * glow;
    color.g += sun.g * glow;
    color.b += sun.b * glow;
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    toneMapped: false,
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geometry, material));
  return {
    scene,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}

/** 一条翼尖尾迹：始终朝向镜头的带状网格，位置每帧按“过去的姿态”重算 */
class Contrail {
  public readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private readonly positions: Float32Array;
  private readonly attribute: THREE.BufferAttribute;

  constructor(material: THREE.MeshBasicMaterial) {
    const vertexCount = TRAIL_POINTS * 2;
    this.positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 4);
    const indices: number[] = [];
    for (let i = 0; i < TRAIL_POINTS; i++) {
      const u = i / (TRAIL_POINTS - 1);
      // 起点很快显现，随后沿长度渐隐
      const alpha = Math.min(1, u / 0.07) * Math.pow(1 - u, 2.1) * 0.55;
      for (let side = 0; side < 2; side++) {
        const offset = (i * 2 + side) * 4;
        colors[offset] = 1;
        colors[offset + 1] = 1;
        colors[offset + 2] = 1;
        colors[offset + 3] = alpha;
      }
      if (i < TRAIL_POINTS - 1) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geometry = new THREE.BufferGeometry();
    this.attribute = new THREE.BufferAttribute(this.positions, 3);
    this.attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', this.attribute);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    geometry.setIndex(indices);
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  /** points：TRAIL_POINTS 个世界坐标（起点在翼尖），cameraPosition 用来求带子的横向 */
  public update(points: readonly THREE.Vector3[], cameraPosition: THREE.Vector3): void {
    const along = scratchA;
    const toCamera = scratchB;
    const side = scratchC;
    for (let i = 0; i < TRAIL_POINTS; i++) {
      const point = points[i];
      const next = points[Math.min(TRAIL_POINTS - 1, i + 1)];
      const previous = points[Math.max(0, i - 1)];
      along.subVectors(next, previous);
      toCamera.subVectors(cameraPosition, point);
      side.crossVectors(along, toCamera);
      const length = side.length();
      const u = i / (TRAIL_POINTS - 1);
      const halfWidth = 0.022 + 0.3 * Math.pow(u, 0.85);
      if (length > 1e-6) {
        side.multiplyScalar(halfWidth / length);
      } else {
        side.set(0, halfWidth, 0);
      }
      const offset = i * 6;
      this.positions[offset] = point.x + side.x;
      this.positions[offset + 1] = point.y + side.y;
      this.positions[offset + 2] = point.z + side.z;
      this.positions[offset + 3] = point.x - side.x;
      this.positions[offset + 4] = point.y - side.y;
      this.positions[offset + 5] = point.z - side.z;
    }
    this.attribute.needsUpdate = true;
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
  }
}

const scratchA = new THREE.Vector3();
const scratchB = new THREE.Vector3();
const scratchC = new THREE.Vector3();
const scratchQuaternion = new THREE.Quaternion();
const scratchYaw = new THREE.Quaternion();
const scratchPitch = new THREE.Quaternion();
const scratchRoll = new THREE.Quaternion();

/** 姿态角 → 四元数（偏航 × 俯仰 × 滚转；机头 -Z，roll > 0 为右翼向下） */
function poseQuaternion(pose: Pose, out: THREE.Quaternion): THREE.Quaternion {
  scratchYaw.setFromAxisAngle(UP, -pose.yaw);
  scratchPitch.setFromAxisAngle(RIGHT, pose.pitch);
  scratchRoll.setFromAxisAngle(FORWARD, pose.roll);
  return out.copy(scratchYaw).multiply(scratchPitch).multiply(scratchRoll);
}

export class MenuHeroScene {
  public readonly canvas: HTMLCanvasElement;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 400);
  private readonly flight = new THREE.Group();
  private readonly jet: THREE.Group;
  private readonly glow: THREE.Sprite;
  private readonly glowMaterial: THREE.SpriteMaterial;
  private readonly glowTexture: THREE.CanvasTexture;
  private readonly wispTexture: THREE.CanvasTexture;
  private readonly wispMaterials: THREE.SpriteMaterial[] = [];
  private readonly wisps: Wisp[] = [];
  private readonly trailMaterial: THREE.MeshBasicMaterial;
  private readonly trails: Contrail[] = [];
  private readonly trailTips: THREE.Vector3[] = [];
  private readonly trailPoints: THREE.Vector3[] = [];
  private readonly streaks: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly streakPositions: Float32Array;
  private readonly streakSpeeds: Float32Array;
  private environment: THREE.WebGLRenderTarget | null = null;
  private readonly onContextLost: () => void;
  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.stop();
    this.onContextLost();
  };

  private readonly pose: Pose = { roll: 0, pitch: 0, yaw: 0, x: 0, y: 0, z: 0 };
  private readonly pastPose: Pose = { roll: 0, pitch: 0, yaw: 0, x: 0, y: 0, z: 0 };
  private readonly reducedMotion: boolean;
  private readonly maxPixelRatio: number;
  private boundingRadius = 3.3;
  private baseDistance = 14;
  private time = 0;
  private lastNow = 0;
  private frame = 0;
  private running = false;
  /** 首帧已经画过（之后尺寸变化时才需要补画） */
  private drawn = false;
  private disposed = false;
  private pointerX = 0;
  private pointerY = 0;
  private smoothPointerX = 0;
  private smoothPointerY = 0;
  /** 进入战场的起始时刻（场景时间）；null = 未触发 */
  private launchStart: number | null = null;

  constructor(options: MenuHeroSceneOptions) {
    this.reducedMotion = options.reducedMotion;
    this.maxPixelRatio = options.maxPixelRatio;
    this.onContextLost = options.onContextLost;

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'tm-hero-canvas';
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost);

    this.setupLights();
    this.setupEnvironment();

    // 主机：与对局同一个工厂
    this.jet = createPlayerMesh();
    // 航行灯是按包围盒摆放的小球：对局里是远处的光点，特写镜头下会像悬在机体外的圆点，这里不显示
    for (const name of SIGNAL_LIGHT_NAMES) {
      const light = this.jet.getObjectByName(name);
      if (light) {
        light.visible = false;
      }
    }
    // 机体自带的翼尖航行灯同理：没有命名，按“很小的球”认（机鼻传感器半径 0.1，不受影响）
    this.jet.traverse((object) => {
      const geometry = (object as THREE.Mesh).geometry as THREE.SphereGeometry | undefined;
      if (
        geometry?.type === 'SphereGeometry' &&
        geometry.parameters.radius <= WINGTIP_LIGHT_RADIUS
      ) {
        object.visible = false;
      }
    });
    this.flight.add(this.jet);
    this.scene.add(this.flight);
    this.measureJet();

    // 引擎辉光（加色，替代泛光后处理）
    this.glowTexture = createGlowTexture();
    this.glowMaterial = new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0xffb070,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    this.glow = new THREE.Sprite(this.glowMaterial);
    this.glow.position.set(0, -0.03, 2.5);
    this.glow.renderOrder = 4;
    this.flight.add(this.glow);

    // 翼尖尾迹
    this.trailMaterial = new THREE.MeshBasicMaterial({
      color: 0xf2f8ff,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < this.trailTips.length; i++) {
      const trail = new Contrail(this.trailMaterial);
      this.trails.push(trail);
      this.scene.add(trail.mesh);
    }
    for (let i = 0; i < TRAIL_POINTS; i++) {
      this.trailPoints.push(new THREE.Vector3());
    }

    // 云絮
    this.wispTexture = createWispTexture();
    this.setupWisps();

    // 气流线
    this.streakPositions = new Float32Array(STREAK_COUNT * 6);
    this.streakSpeeds = new Float32Array(STREAK_COUNT);
    this.streaks = this.createStreaks();
    this.scene.add(this.streaks);

    options.host.appendChild(this.canvas);
    this.resize(options.host.clientWidth, options.host.clientHeight);

    // 先把着色器交给驱动编译（支持并行编译时不阻塞）；首帧由控制器稍后调用 start() 再画
    this.updateScene(0);
    this.renderer.compile(this.scene, this.camera);
  }

  // ───────────────────────────── 搭建 ─────────────────────────────

  private setupLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x1c2a44, 1.1));

    const sun = new THREE.DirectionalLight(0xffc48a, 3.6);
    sun.position.copy(SUN_DIRECTION).multiplyScalar(50);
    this.scene.add(sun);

    // 镜头一侧的冷色补光：背光面不至于糊成剪影
    const fill = new THREE.DirectionalLight(0x9fdcff, 1.5);
    fill.position.set(12, 7, 9);
    this.scene.add(fill);

    // 云海向上的暖色反光
    const bounce = new THREE.DirectionalLight(0xffb27a, 0.55);
    bounce.position.set(-3, -9, -4);
    this.scene.add(bounce);
  }

  /** 环境贴图：金属机身靠它反射天空；生成失败时只用灯光 */
  private setupEnvironment(): void {
    let generator: THREE.PMREMGenerator | null = null;
    const environment = createEnvironmentScene();
    try {
      generator = new THREE.PMREMGenerator(this.renderer);
      this.environment = generator.fromScene(environment.scene, 0.03);
      this.scene.environment = this.environment.texture;
    } catch (error) {
      console.warn('[MenuHero] environment map unavailable', error);
      this.environment = null;
    } finally {
      generator?.dispose();
      environment.dispose();
    }
  }

  /** 量出机体包围球与两侧翼尖（尾迹起点）：取 |x| 最大处最靠后的顶点 */
  private measureJet(): void {
    this.jet.updateWorldMatrix(true, true);
    const box = new THREE.Box3();
    const vertex = new THREE.Vector3();
    let maxX = 0;
    this.jet.traverse((object) => {
      const mesh = object as THREE.Mesh;
      const position = mesh.geometry?.getAttribute?.('position');
      // 尾焰是加色的半透明体、航行灯已隐藏，都不计入机体尺寸
      if (!position || !mesh.visible || mesh.name.startsWith('afterburner')) {
        return;
      }
      for (let i = 0; i < position.count; i++) {
        vertex.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
        box.expandByPoint(vertex);
        maxX = Math.max(maxX, Math.abs(vertex.x));
      }
    });
    if (box.isEmpty() || !Number.isFinite(maxX) || maxX <= 0) {
      this.trailTips.push(new THREE.Vector3(2.4, 0, 0.9), new THREE.Vector3(-2.4, 0, 0.9));
      return;
    }
    const radius = box.getSize(new THREE.Vector3()).length() / 2;
    if (Number.isFinite(radius) && radius > 0) {
      this.boundingRadius = radius;
    }
    // 翼尖后缘：|x| 接近最大值的顶点里 z 最大（最靠机尾）的那个
    let tipZ = -Infinity;
    let tipY = 0;
    this.jet.traverse((object) => {
      const mesh = object as THREE.Mesh;
      const position = mesh.geometry?.getAttribute?.('position');
      if (!position || !mesh.visible || mesh.name.startsWith('afterburner')) {
        return;
      }
      for (let i = 0; i < position.count; i++) {
        vertex.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
        if (vertex.x > maxX - 0.12 && vertex.z > tipZ) {
          tipZ = vertex.z;
          tipY = vertex.y;
        }
      }
    });
    const z = Number.isFinite(tipZ) ? tipZ : 0.9;
    this.trailTips.push(new THREE.Vector3(maxX, tipY, z), new THREE.Vector3(-maxX, tipY, z));
  }

  private setupWisps(): void {
    // 三档不透明度的共享材质（Sprite 的透明度在材质上）
    for (const [color, opacity] of [
      [0xffe6cc, 0.3],
      [0xd9e8f7, 0.2],
      [0xffffff, 0.085],
    ] as const) {
      this.wispMaterials.push(
        new THREE.SpriteMaterial({
          map: this.wispTexture,
          color,
          transparent: true,
          opacity,
          depthWrite: false,
          fog: false,
        })
      );
    }
    for (let i = 0; i < WISP_COUNT; i++) {
      // 少数几片从镜头与飞机之间掠过，其余在飞机身后的远处
      const near = i % 6 === 5;
      const material = near ? this.wispMaterials[2] : this.wispMaterials[i % 2];
      const sprite = new THREE.Sprite(material);
      sprite.renderOrder = near ? 5 : 1;
      const wisp: Wisp = { sprite, speed: 1, near };
      this.placeWisp(wisp, WISP_FRONT_Z + Math.random() * (WISP_BACK_Z - WISP_FRONT_Z));
      this.wisps.push(wisp);
      this.scene.add(sprite);
    }
  }

  private placeWisp(wisp: Wisp, z: number): void {
    const sprite = wisp.sprite;
    if (wisp.near) {
      sprite.position.set(3 + Math.random() * 5, -2.5 + Math.random() * 5, z);
      const size = 9 + Math.random() * 7;
      sprite.scale.set(size * 2.6, size, 1);
      wisp.speed = 1.5 + Math.random() * 0.6;
    } else {
      sprite.position.set(-48 + Math.random() * 40, -11 + Math.random() * 15, z);
      const size = 7 + Math.random() * 12;
      sprite.scale.set(size * 2.8, size, 1);
      wisp.speed = 0.8 + Math.random() * 0.5;
    }
  }

  private createStreaks(): THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> {
    for (let i = 0; i < STREAK_COUNT; i++) {
      this.placeStreak(i, -60 + Math.random() * 90);
    }
    const geometry = new THREE.BufferGeometry();
    const attribute = new THREE.BufferAttribute(this.streakPositions, 3);
    attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', attribute);
    const material = new THREE.LineBasicMaterial({
      color: 0xd8f1ff,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(geometry, material);
    lines.frustumCulled = false;
    lines.renderOrder = 3;
    return lines;
  }

  private placeStreak(index: number, z: number): void {
    let x = 0;
    let y = 0;
    // 避开机体所在的那一条通道
    do {
      x = -16 + Math.random() * 25;
      y = -6.5 + Math.random() * 13;
    } while (Math.abs(x) < 3 && Math.abs(y) < 1.4);
    const length = 2.5 + Math.random() * 5;
    const offset = index * 6;
    this.streakPositions[offset] = x;
    this.streakPositions[offset + 1] = y;
    this.streakPositions[offset + 2] = z;
    this.streakPositions[offset + 3] = x;
    this.streakPositions[offset + 4] = y;
    this.streakPositions[offset + 5] = z + length;
    this.streakSpeeds[index] = 2.2 + Math.random() * 1.4;
  }

  // ───────────────────────────── 每帧 ─────────────────────────────

  /** t 时刻的飞行姿态（解析式：尾迹可以直接取“过去”的姿态，不用存历史） */
  private samplePose(t: number, out: Pose): Pose {
    out.roll = 0.3 + 0.17 * Math.sin(t * 0.31) + 0.05 * Math.sin(t * 0.83 + 1.1);
    out.pitch = 0.035 + 0.03 * Math.sin(t * 0.27 + 0.8);
    out.yaw = 0.05 * Math.sin(t * 0.19 + 2);
    out.x = 0.25 * Math.sin(t * 0.23 + 0.4);
    out.y = 0.22 * Math.sin(t * 0.52) + 0.08 * Math.sin(t * 1.13 + 0.6);
    out.z = 0;
    if (this.launchStart !== null && t > this.launchStart) {
      const elapsed = t - this.launchStart;
      out.z = -0.5 * LAUNCH_ACCELERATION * elapsed * elapsed;
      out.pitch += Math.min(0.12, elapsed * 0.35);
    }
    return out;
  }

  private updateScene(dt: number): void {
    const t = this.time;
    const launching = this.launchStart !== null;
    const launchElapsed = this.launchStart !== null ? Math.max(0, t - this.launchStart) : 0;

    // 飞机姿态
    const pose = this.samplePose(t, this.pose);
    this.flight.position.set(pose.x, pose.y, pose.z);
    poseQuaternion(pose, this.flight.quaternion);

    updatePlayerAfterburner(
      this.jet,
      { speedRatio: launching ? 1 : 0.62, boosting: launching },
      dt
    );
    updateAircraftSignals(dt);

    // 引擎辉光：轻微闪动，加力时放大
    const flicker = 1 + 0.06 * Math.sin(t * 31) + 0.04 * Math.sin(t * 53 + 1.7);
    const boost = Math.min(1, launchElapsed * 6);
    const glowSize = (1.7 + 1.9 * boost) * flicker;
    this.glow.scale.set(glowSize, glowSize, 1);
    this.glowMaterial.opacity = Math.min(1, (0.55 + 0.4 * boost) * flicker);

    // 镜头：缓慢环绕 + 指针视差（平滑跟随）
    const follow = 1 - Math.exp(-dt * 3);
    this.smoothPointerX += (this.pointerX - this.smoothPointerX) * follow;
    this.smoothPointerY += (this.pointerY - this.smoothPointerY) * follow;
    const azimuth = ORBIT_AZIMUTH + 0.15 * Math.sin(t * 0.09) + this.smoothPointerX * 0.07;
    const elevation =
      ORBIT_ELEVATION + 0.05 * Math.sin(t * 0.13 + 1.3) - this.smoothPointerY * 0.05;
    const distance = this.baseDistance * (1 + 0.03 * Math.sin(t * 0.07 + 0.5));
    const cosElevation = Math.cos(elevation);
    this.camera.position.set(
      CAMERA_TARGET.x + distance * Math.sin(azimuth) * cosElevation,
      CAMERA_TARGET.y + distance * Math.sin(elevation),
      CAMERA_TARGET.z + distance * Math.cos(azimuth) * cosElevation
    );
    this.camera.lookAt(CAMERA_TARGET);
    if (launching) {
      this.camera.fov = FOV + 7 * Math.min(1, launchElapsed * 4);
      this.camera.updateProjectionMatrix();
    }

    // 翼尖尾迹：第 i 个点 = τ 秒前的翼尖位置，再随气流后移 AIRSPEED × τ
    for (let trail = 0; trail < this.trails.length; trail++) {
      const tip = this.trailTips[trail];
      for (let i = 0; i < TRAIL_POINTS; i++) {
        const age = (i / (TRAIL_POINTS - 1)) * TRAIL_SECONDS;
        const past = this.samplePose(t - age, this.pastPose);
        poseQuaternion(past, scratchQuaternion);
        const point = this.trailPoints[i];
        point.copy(tip).applyQuaternion(scratchQuaternion);
        point.x += past.x;
        point.y += past.y;
        point.z += past.z + AIRSPEED * age;
      }
      this.trails[trail].update(this.trailPoints, this.camera.position);
    }

    // 云絮与气流线向后流动，出界后回到前方
    const flow = AIRSPEED * (1 + 2.2 * boost) * dt;
    for (const wisp of this.wisps) {
      wisp.sprite.position.z += flow * wisp.speed;
      if (wisp.sprite.position.z > WISP_BACK_Z) {
        this.placeWisp(wisp, WISP_FRONT_Z - Math.random() * 12);
      }
    }
    for (let i = 0; i < STREAK_COUNT; i++) {
      const offset = i * 6;
      const step = flow * this.streakSpeeds[i];
      this.streakPositions[offset + 2] += step;
      this.streakPositions[offset + 5] += step;
      if (this.streakPositions[offset + 2] > 34) {
        this.placeStreak(i, -62 - Math.random() * 10);
      }
    }
    this.streaks.geometry.getAttribute('position').needsUpdate = true;
    this.streaks.material.opacity = 0.2 + 0.25 * boost;
  }

  private readonly tick = (now: number): void => {
    if (!this.running) {
      return;
    }
    this.frame = requestAnimationFrame(this.tick);
    const elapsed = (now - this.lastNow) / 1000;
    this.lastNow = now;
    // 切回前台后的第一帧间隔很长：钳住，避免画面跳变
    const dt = Number.isFinite(elapsed) ? Math.min(0.05, Math.max(0, elapsed)) : 0;
    this.time += dt;
    this.updateScene(dt);
    this.renderer.render(this.scene, this.camera);
    this.drawn = true;
  };

  // ───────────────────────────── 对外 ─────────────────────────────

  /** 启动渲染循环；减少动态效果时只画一帧定格 */
  public start(): void {
    if (this.disposed || this.running) {
      return;
    }
    if (this.reducedMotion) {
      this.renderStill();
      return;
    }
    this.running = true;
    this.lastNow = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  public stop(): void {
    this.running = false;
    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
  }

  public isRunning(): boolean {
    return this.running;
  }

  /** 画一帧（首帧 / 定格 / 尺寸变化后） */
  public renderStill(): void {
    if (this.disposed) {
      return;
    }
    if (this.reducedMotion) {
      this.time = STILL_TIME;
    }
    this.updateScene(0);
    this.renderer.render(this.scene, this.camera);
    this.drawn = true;
  }

  /**
   * 按容器尺寸取景：横屏时飞机在画面右侧（左边留给标题与按钮），竖屏时在中上部；
   * 用 setViewOffset 平移投影中心，透视方向不变。
   */
  public resize(width: number, height: number): void {
    if (this.disposed || !(width > 0) || !(height > 0)) {
      return;
    }
    const pixelRatio = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);

    const portrait = height > width;
    const short = !portrait && height < 520;
    const focusX = portrait ? 0.5 : short ? 0.72 : 0.69;
    const focusY = portrait ? 0.39 : short ? 0.5 : 0.47;
    // 飞机（包围球直径）在画面上占的像素
    const span = portrait
      ? Math.min(width * 0.98, height * 0.62)
      : Math.min(width * 0.6, height * (short ? 1.25 : 1.12));
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    this.baseDistance = (this.boundingRadius * height) / (Math.max(1, span) * tanHalf);

    this.camera.aspect = width / height;
    this.camera.setViewOffset(
      width,
      height,
      (0.5 - focusX) * width,
      (0.5 - focusY) * height,
      width,
      height
    );
    this.camera.updateProjectionMatrix();
    if (this.drawn && !this.running) {
      this.renderStill();
    }
  }

  /** 指针位置（-1..1）：镜头轻微跟随 */
  public setPointer(x: number, y: number): void {
    this.pointerX = Number.isFinite(x) ? x : 0;
    this.pointerY = Number.isFinite(y) ? y : 0;
  }

  /** 进入战场：点燃加力，飞机加速冲出画面 */
  public launch(): void {
    if (this.launchStart === null && !this.reducedMotion) {
      this.launchStart = this.time;
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.stop();
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);

    this.scene.environment = null;
    this.environment?.dispose();
    this.environment = null;

    disposeModelTree(this.jet);
    for (const trail of this.trails) {
      trail.dispose();
    }
    this.trailMaterial.dispose();
    this.streaks.geometry.dispose();
    this.streaks.material.dispose();
    for (const material of this.wispMaterials) {
      material.dispose();
    }
    this.wispTexture.dispose();
    this.glowMaterial.dispose();
    this.glowTexture.dispose();
    this.scene.clear();

    releaseRenderer(this.renderer);
  }
}
