/**
 * 地形环境模块契约（Terrain environment contract）。
 *
 * 第 6-10 关的地形类型（VOLCANO / ARCTIC / CANYON / STRATOSPHERE / CITADEL）不再把生成逻辑堆进
 * TerrainGenerator，而是各自实现一个 TerrainEnvironment 模块，由 TerrainGenerator 统一调度：
 *
 * 1. generateTerrain()：按 TerrainType 从注册表（environments/index.ts）创建实例并调用 build(ctx)。
 *    环境把自己的全部对象放进 `root`；TerrainGenerator 负责把 root 挂到地形分组下。
 * 2. 每帧：TerrainGenerator.update() 调用可选的 update(dt, elapsed, focus)。focus 为玩家最近位置
 *    （≈ 相机位置），可用来让粒子/LOD 跟随视点。
 * 3. 采样：TerrainGenerator.sampleSurface() / getCrashSurfaceY() 通过 sampleEnvironmentSurface()
 *    组合 sampleHeight() 与 isWater()。
 * 4. 换关：clearTerrain() 调用 dispose()；环境必须移除 root 并释放其下全部几何体、材质与纹理
 *    （userData.sharedResource === true 的对象除外，见 envKit.disposeObjectTree）。
 *
 * 约定：
 * - 模块导入时不得访问 document / window；纹理创建在缺少 document 时返回 null 或使用无纹理回退。
 * - 透明发光 / 极光 / 灰烬等材质：renderOrder 0、transparent、depthTest true、depthWrite false。
 * - 每帧代码复用预分配对象；采样函数对 NaN/Infinity 输入返回有限值。
 */
import type * as THREE from 'three';
import type { LevelConfig, SceneDesignTokens, TerrainType } from '../LevelConfig';

/** sampleSurface 的返回值：y 为世界表面高度（水域为水面高度），water 表示船只可航行 */
export interface TerrainSurfaceSample {
  y: number;
  water: boolean;
}

/**
 * 地表材质（命中特效 / 音效选型用）：与 ParticleSystem 的 SurfaceImpactType
 * （'ground' | 'desert' | 'snow' | 'city' | 'lava' | 'ice' | 'rock' | 'cloud'）一致，另加 'water'。
 */
export type TerrainSurfaceKind =
  | 'water'
  | 'ground'
  | 'desert'
  | 'snow'
  | 'city'
  | 'lava'
  | 'ice'
  | 'rock'
  | 'cloud';

/** build() 时由 TerrainGenerator 注入的关卡上下文 */
export interface TerrainEnvironmentContext {
  readonly config: LevelConfig;
  /** 当前关卡设计令牌（关卡未配置时为地形兜底调色板） */
  readonly tokens: SceneDesignTokens;
  /** 世界水位 Y（WORLDSCAPE_WATER_Y = -48） */
  readonly waterY: number;
  /** 战场水平半径（米） */
  readonly halfExtent: number;
  /** 装饰元素数量缩放（移动端 0.55，桌面 1） */
  readonly detailScale: number;
  readonly isMobile: boolean;
  /** 归一化主光方向（太阳/月亮），水面高光与朝光着色使用 */
  readonly sunDirection: THREE.Vector3;
  /** 风向（弧度，0 = +X，π/2 = +Z）与风力 0..1，烟柱/漂移使用 */
  readonly windAngle: number;
  readonly windStrength: number;
}

export interface TerrainEnvironment {
  readonly terrain: TerrainType;
  /** 环境全部对象的根节点（build 之后由 TerrainGenerator 挂入场景） */
  readonly root: THREE.Group;
  /** 是否存在可航行水面：为 true 时低于水位的地面在 sampleSurface 中被钳到水面 */
  readonly hasWater: boolean;
  /** 构建全部网格（只调用一次） */
  build(ctx: TerrainEnvironmentContext): void;
  /** (x, z) 处固体表面（地面 / 冰面 / 结构顶部）的世界 Y；水下返回海床高度 */
  sampleHeight(worldX: number, worldZ: number): number;
  /** (x, z) 处是否为船只可航行的开阔水面 */
  isWater(worldX: number, worldZ: number): boolean;
  /** (x, z) 处地表材质（可选；缺省时水面为 'water'，其余为 'rock'） */
  surfaceKindAt?(worldX: number, worldZ: number): TerrainSurfaceKind;
  /** 每帧动画（可选）：elapsed 为关卡累计时间，focus 为玩家最近位置 */
  update?(deltaTime: number, elapsed: number, focus: THREE.Vector3): void;
  /** 移除 root 并释放全部 GPU 资源 */
  dispose(): void;
}

/** TerrainEnvironment 工厂：每次 generateTerrain 都创建一个新实例 */
export type TerrainEnvironmentFactory = () => TerrainEnvironment;

/**
 * 把环境的高度/水面采样组合成 sampleSurface 语义：
 * - 可航行水面 → { y: waterY, water: true }
 * - 其余 → 固体表面高度；有水的环境中低于水位的浅滩被钳到水面（不可航行）
 * 输入或采样结果非有限值时回落到 waterY。
 */
export function sampleEnvironmentSurface(
  environment: TerrainEnvironment,
  worldX: number,
  worldZ: number,
  waterY: number
): TerrainSurfaceSample {
  if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) {
    return { y: waterY, water: false };
  }
  if (environment.hasWater && environment.isWater(worldX, worldZ)) {
    return { y: waterY, water: true };
  }
  const ground = environment.sampleHeight(worldX, worldZ);
  const y = Number.isFinite(ground) ? ground : waterY;
  return { y: environment.hasWater ? Math.max(y, waterY) : y, water: false };
}

/** 环境地表材质：优先环境自身的 surfaceKindAt，否则按可航行水面 / 岩石区分 */
export function environmentSurfaceKind(
  environment: TerrainEnvironment,
  worldX: number,
  worldZ: number
): TerrainSurfaceKind {
  if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) {
    return 'ground';
  }
  if (environment.surfaceKindAt) {
    return environment.surfaceKindAt(worldX, worldZ);
  }
  return environment.hasWater && environment.isWater(worldX, worldZ) ? 'water' : 'rock';
}
